/**
 * Event handlers for the Octer WebSocket monitor.
 *
 * Following the openclaw-lark channel/event-handlers.ts pattern,
 * each handler receives a MonitorContext with all dependencies
 * needed to process the event.
 */

import { handleToolRequest } from '../messaging/inbound/handler.js'
import { enqueueTask } from './chat-queue.js'

/**
 * Route an incoming WebSocket message to the appropriate handler.
 *
 * @param {import('./types.js').MonitorContext} ctx
 * @param {object} msg - Parsed JSON message from the backend
 */
export async function handleIncomingMessage(ctx, msg) {
  switch (msg.type) {
    case 'tool_request':
      await handleToolRequestEvent(ctx, msg)
      break
    case 'pong':
      // keepalive ack — no action needed
      break
    default:
      ctx.log(`[octer-channel] Unknown message type: ${msg.type}`)
  }
}

/**
 * Handle a tool_request event from the cloud backend.
 *
 * Validates the request, checks for duplicates, and enqueues
 * the task for serial execution via the chat queue.
 *
 * @param {import('./types.js').MonitorContext} ctx
 * @param {import('./types.js').ToolRequestMessage} msg
 */
async function handleToolRequestEvent(ctx, msg) {
  const { accountId, log, error } = ctx
  const requestId = msg.request_id ?? 'unknown'

  try {
    // Dedup — skip duplicate requests (e.g. from WebSocket reconnects)
    if (!ctx.requestDedup.tryRecord(requestId)) {
      log(`[octer-channel][${accountId}] duplicate request ${requestId}, skipping`)
      return
    }

    // Enqueue for serial execution (following openclaw-lark enqueueFeishuChatTask)
    const { status } = enqueueTask({
      accountId,
      requestId,
      task: async () => {
        try {
          await handleToolRequest(ctx, msg)
        } catch (err) {
          error(`[octer-channel][${accountId}] error handling request: ${String(err)}`)
        }
      },
    })

    log(`[octer-channel][${accountId}] request ${requestId} — ${status}`)
  } catch (err) {
    error(`[octer-channel][${accountId}] error handling tool_request: ${String(err)}`)
  }
}
