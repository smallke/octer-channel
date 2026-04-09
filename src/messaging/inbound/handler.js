/**
 * Inbound tool_request handler for the Octer channel.
 *
 * Uses the OpenClaw SDK channelRuntime to dispatch messages to the agent,
 * following the openclaw-lark messaging/process-message.ts pattern.
 * No CLI spawn — runs in-process via the Gateway runtime.
 */

import { OcterClient } from '../../core/octer-client.js'
import { sendToolResponse } from '../outbound/outbound.js'

const CHANNEL_ID = 'octer'

/**
 * Generate a unique message SID.
 */
function generateMessageSid() {
  return `octer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Build a MsgContext from a tool_request, matching the shape expected
 * by the OpenClaw core pipeline (same as WeixinMsgContext).
 *
 * @param {string} query - The user's query text
 * @param {string} requestId - The tool_request ID (used as peer identity)
 * @param {string} accountId
 * @returns {object} MsgContext
 */
function buildMsgContext(query, requestId, accountId) {
  return {
    Body: query,
    From: requestId,
    To: requestId,
    AccountId: accountId,
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: requestId,
    MessageSid: generateMessageSid(),
    Timestamp: Date.now(),
    Provider: CHANNEL_ID,
    ChatType: 'direct',
    CommandBody: query,
    CommandAuthorized: true,
  }
}

/**
 * Handle a tool_request message from the cloud backend.
 *
 * Routes the query through the SDK channelRuntime pipeline:
 *   resolveAgentRoute → recordInboundSession → dispatchReplyFromConfig
 *
 * The agent's reply is collected in the `deliver` callback and sent
 * back as a tool_response via the WebSocket.
 *
 * @param {import('../../channel/types.js').MonitorContext} ctx
 * @param {import('../../channel/types.js').ToolRequestMessage} msg
 */
export async function handleToolRequest(ctx, msg) {
  const { request_id: requestId, tool_name: toolName, arguments: args } = msg
  const query = args?.query || ''

  ctx.log(`[octer-channel] tool_request id=${requestId} tool=${toolName}`)
  ctx.log(`[octer-channel]   query: ${query.slice(0, 200)}`)

  let channelRuntime
  try {
    channelRuntime = OcterClient.runtime.channel
  } catch {
    ctx.error(`[octer-channel] SDK runtime not available, cannot dispatch`)
    sendToolResponse(ctx.client, { requestId, result: null, error: 'SDK runtime not initialized', success: false })
    return
  }

  const config = ctx.config || OcterClient.globalConfig || {}
  const accountId = ctx.accountId || 'default'
  const msgCtx = buildMsgContext(query, requestId, accountId)

  try {
    // 1. Resolve agent route
    const route = channelRuntime.routing.resolveAgentRoute({
      cfg: config,
      channel: CHANNEL_ID,
      accountId,
      peer: { kind: 'direct', id: requestId },
    })
    ctx.log(`[octer-channel] route: agent=${route.agentId ?? '(default)'} session=${route.sessionKey ?? '(auto)'}`)

    // Propagate session key
    msgCtx.SessionKey = route.sessionKey

    // 2. Finalize inbound context
    const finalized = channelRuntime.reply.finalizeInboundContext(msgCtx)

    // 3. Record inbound session
    const storePath = channelRuntime.session.resolveStorePath(config.session?.store, {
      agentId: route.agentId,
    })
    await channelRuntime.session.recordInboundSession({
      storePath,
      sessionKey: route.sessionKey,
      ctx: finalized,
      updateLastRoute: {
        sessionKey: route.mainSessionKey,
        channel: CHANNEL_ID,
        to: msgCtx.To,
        accountId,
      },
      onRecordError: (err) => ctx.error(`[octer-channel] recordInboundSession: ${String(err)}`),
    })

    // 4. Create reply dispatcher — collect all reply chunks
    const replyChunks = []

    const { dispatcher, replyOptions, markDispatchIdle } =
      channelRuntime.reply.createReplyDispatcherWithTyping({
        humanDelay: channelRuntime.reply.resolveHumanDelayConfig(config, route.agentId),
        typingCallbacks: { start: async () => {}, stop: async () => {}, keepalive: async () => {} },
        deliver: async (payload) => {
          const text = payload.text ?? ''
          if (text) replyChunks.push(text)
        },
        onError: (err) => {
          ctx.error(`[octer-channel] reply dispatch error: ${String(err)}`)
        },
      })

    // 5. Dispatch to agent
    await channelRuntime.reply.withReplyDispatcher({
      dispatcher,
      run: () =>
        channelRuntime.reply.dispatchReplyFromConfig({
          ctx: finalized,
          cfg: config,
          dispatcher,
          replyOptions,
        }),
    })
    markDispatchIdle()

    // 6. Send collected reply back as tool_response
    const result = replyChunks.join('\n') || '(no response)'
    ctx.log(`[octer-channel] tool_response id=${requestId} success=true (${result.length} chars)`)
    sendToolResponse(ctx.client, { requestId, result, error: null, success: true })
  } catch (err) {
    ctx.error(`[octer-channel] tool_response id=${requestId} error: ${String(err)}`)
    sendToolResponse(ctx.client, { requestId, result: null, error: String(err), success: false })
  }
}
