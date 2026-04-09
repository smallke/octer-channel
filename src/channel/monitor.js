/**
 * WebSocket monitoring for the Octer channel plugin.
 *
 * Following the openclaw-lark channel/monitor.ts pattern,
 * manages the WebSocket connection and routes inbound events
 * to the appropriate handlers.
 */

import { OcterClient } from '../core/octer-client.js'
import { RequestDedup } from './chat-queue.js'
import { handleIncomingMessage } from './event-handlers.js'
import { registerOutboundClient, unregisterOutboundClient } from '../messaging/outbound/outbound.js'

/**
 * Start monitoring a single Octer account.
 *
 * Creates an OcterClient, initializes request dedup, registers event
 * handlers, and starts the WebSocket connection. Returns a Promise
 * that resolves when the abort signal fires.
 *
 * @param {{ apiKey: string, accountId: string, config?: object, runtime?: object, abortSignal?: AbortSignal }} params
 * @returns {Promise<void>}
 */
async function monitorSingleAccount(params) {
  const { apiKey, accountId, config, runtime, abortSignal } = params
  const log = runtime?.log ?? ((...args) => console.info(...args))
  const error = runtime?.error ?? ((...args) => console.error(...args))

  // Request dedup — filters duplicate deliveries from WebSocket reconnects
  const requestDedup = new RequestDedup()
  log(`[octer-channel][${accountId}] request dedup enabled`)
  log(`[octer-channel][${accountId}] starting WebSocket connection...`)

  // Create OcterClient instance — manages WebSocket lifecycle
  const client = OcterClient.fromApiKey(apiKey, { accountId, log, error })

  // Register client for outbound use (so ChannelOutboundAdapter can send)
  registerOutboundClient(accountId, client)

  /** @type {import('./types.js').MonitorContext} */
  const ctx = {
    apiKey,
    accountId,
    client,
    requestDedup,
    config,
    runtime,
    log,
    error,
  }

  try {
    // Start WebSocket and route all messages through event-handlers
    await client.startWS({
      onMessage: (msg) => handleIncomingMessage(ctx, msg),
      onConnected: () => {
        log(`[octer-channel][${accountId}] WebSocket client started`)
      },
      abortSignal,
    })
  } finally {
    // Cleanup on shutdown
    unregisterOutboundClient(accountId)
    client.stop()
    log(`[octer-channel][${accountId}] monitor stopped`)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start monitoring for an Octer account.
 *
 * Following the openclaw-lark monitorFeishuProvider pattern,
 * accepts opts and starts the WebSocket monitor.
 *
 * @param {import('./types.js').MonitorOcterOpts} [opts]
 * @returns {Promise<void>}
 */
export async function monitorOcterProvider(opts = {}) {
  const cfg = opts.config
  const apiKey = opts.apiKey || cfg?.channels?.octer?.apiKey

  if (!apiKey) {
    throw new Error('API key is required for Octer monitor')
  }

  // Store global config (like LarkClient.setGlobalConfig)
  if (cfg) {
    OcterClient.setGlobalConfig(cfg)
  }

  const accountId = opts.accountId || 'default'
  const log = opts.runtime?.log ?? ((...args) => console.info(...args))

  log(`[octer-channel] starting account: ${accountId}`)

  await monitorSingleAccount({
    apiKey,
    accountId,
    config: cfg,
    runtime: opts.runtime,
    abortSignal: opts.abortSignal,
  })
}
