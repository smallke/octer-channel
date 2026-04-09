/**
 * Outbound adapter for the Octer channel.
 *
 * Following the openclaw-lark messaging/outbound/outbound.ts pattern,
 * implements ChannelOutboundAdapter to send messages back through
 * the Octer WebSocket connection.
 *
 * The SDK calls these methods when the agent produces a reply.
 */

/**
 * Send a tool_response message through the active WebSocket client.
 *
 * @param {import('../../core/octer-client.js').OcterClient} client
 * @param {{ requestId: string, result: string|null, error: string|null, success: boolean }} params
 * @returns {boolean}
 */
export function sendToolResponse(client, params) {
  return client.send({
    type: 'tool_response',
    request_id: params.requestId,
    result: params.result,
    error: params.error,
    success: params.success,
  })
}

/**
 * Send a text message via the Octer WebSocket channel.
 *
 * @param {{ cfg: object, to: string, text: string, accountId?: string }} params
 * @returns {Promise<{ channel: string, messageId: string }>}
 */
export async function sendMessageOcter(params) {
  const { to, text, accountId } = params

  // Get the active client from the monitor context
  const client = _activeClients.get(accountId || 'default')
  if (!client) {
    throw new Error(`[octer-channel] No active client for account ${accountId || 'default'}`)
  }

  const messageId = `octer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  client.send({
    type: 'message',
    to,
    text,
    message_id: messageId,
  })

  return { channel: 'octer', messageId }
}

// ---------------------------------------------------------------------------
// Active client registry (populated by monitor.js)
// ---------------------------------------------------------------------------

/** @type {Map<string, import('../../core/octer-client.js').OcterClient>} */
const _activeClients = new Map()

/**
 * Register an active OcterClient instance for outbound use.
 * Called by monitor.js when a WebSocket connection is established.
 * @param {string} accountId
 * @param {import('../../core/octer-client.js').OcterClient} client
 */
export function registerOutboundClient(accountId, client) {
  _activeClients.set(accountId, client)
}

/**
 * Unregister an OcterClient instance.
 * @param {string} accountId
 */
export function unregisterOutboundClient(accountId) {
  _activeClients.delete(accountId)
}

// ---------------------------------------------------------------------------
// ChannelOutboundAdapter (following openclaw-lark feishuOutbound pattern)
// ---------------------------------------------------------------------------

/**
 * ChannelOutboundAdapter implementation for the Octer channel.
 *
 * The SDK uses this adapter to deliver agent replies back to the user
 * through the WebSocket bridge.
 */
export const octerOutbound = {
  deliveryMode: 'direct',

  textChunkLimit: 50000,

  chunkerMode: 'markdown',

  chunker: (text, limit) => {
    // Simple chunker: split by limit respecting newlines
    if (text.length <= limit) return [text]
    const chunks = []
    let remaining = text
    while (remaining.length > 0) {
      if (remaining.length <= limit) {
        chunks.push(remaining)
        break
      }
      // Find a good break point (newline near limit)
      let breakAt = remaining.lastIndexOf('\n', limit)
      if (breakAt < limit * 0.5) breakAt = limit
      chunks.push(remaining.slice(0, breakAt))
      remaining = remaining.slice(breakAt)
    }
    return chunks
  },

  sendText: async ({ cfg, to, text, accountId, replyToId, threadId }) => {
    const client = _activeClients.get(accountId || 'default')
    if (!client) {
      throw new Error(`[octer-channel] No active client for account ${accountId || 'default'}`)
    }

    const messageId = `octer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    client.send({
      type: 'message',
      to,
      text,
      message_id: messageId,
      reply_to: replyToId || undefined,
      thread_id: threadId || undefined,
    })

    return { channel: 'octer', messageId }
  },

  sendMedia: async ({ cfg, to, text, mediaUrl, accountId, replyToId, threadId }) => {
    // Octer bridge does not support native media; send as text with URL
    const client = _activeClients.get(accountId || 'default')
    if (!client) {
      throw new Error(`[octer-channel] No active client for account ${accountId || 'default'}`)
    }

    const messageId = `octer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const body = mediaUrl ? `${text || ''}\n${mediaUrl}`.trim() : (text || '')
    client.send({
      type: 'message',
      to,
      text: body,
      message_id: messageId,
      reply_to: replyToId || undefined,
    })

    return { channel: 'octer', messageId }
  },

  sendPayload: async ({ cfg, to, payload, accountId, replyToId, threadId }) => {
    const text = payload?.text || ''
    const client = _activeClients.get(accountId || 'default')
    if (!client) {
      throw new Error(`[octer-channel] No active client for account ${accountId || 'default'}`)
    }

    const messageId = `octer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    client.send({
      type: 'message',
      to,
      text,
      message_id: messageId,
      reply_to: replyToId || undefined,
      thread_id: threadId || undefined,
      payload: payload?.channelData?.octer || undefined,
    })

    return { channel: 'octer', messageId }
  },
}
