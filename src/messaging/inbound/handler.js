/**
 * Inbound tool_request handler for the Octer channel.
 *
 * Following the openclaw-lark messaging/inbound/handler.ts pattern,
 * processes incoming tool_request messages.
 *
 * For the bridge use-case, each request spawns an independent
 * `openclaw agent` CLI process. This avoids session contention
 * that occurs with the SDK's shared-session dispatch — ensuring
 * concurrent requests are handled correctly.
 */

import { executeOpenClaw } from '../../core/executor.js'
import { sendToolResponse } from '../outbound/outbound.js'

/**
 * Handle a tool_request message from the cloud backend.
 *
 * @param {import('../../channel/types.js').MonitorContext} ctx
 * @param {import('../../channel/types.js').ToolRequestMessage} msg
 */
export async function handleToolRequest(ctx, msg) {
  const { request_id: requestId, tool_name: toolName, arguments: args } = msg
  const query = args?.query || ''

  ctx.log(`[octer-channel] tool_request id=${requestId} tool=${toolName}`)
  ctx.log(`[octer-channel]   query: ${query.slice(0, 200)}`)

  try {
    const result = await executeOpenClaw(query)
    ctx.log(`[octer-channel] tool_response id=${requestId} success=true (${result.length} chars)`)
    sendToolResponse(ctx.client, { requestId, result, error: null, success: true })
  } catch (err) {
    ctx.error(`[octer-channel] tool_response id=${requestId} error: ${err.message}`)
    sendToolResponse(ctx.client, { requestId, result: null, error: err.message, success: false })
  }
}
