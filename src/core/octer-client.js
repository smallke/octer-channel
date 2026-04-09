/**
 * WebSocket client management for the Octer channel.
 *
 * Following the openclaw-lark LarkClient pattern:
 * - Manages WebSocket connection lifecycle, keepalive, and reconnection
 * - Stores a reference to the OpenClaw SDK PluginRuntime for dispatch
 * - Provides static accessors for runtime and global config
 */

import WebSocket from 'ws'
import os from 'os'

const BACKEND_WS_URL = 'wss://octer.ai/ws/bridge'
const RECONNECT_INTERVAL = 3000 // ms
const PING_INTERVAL = 30000 // ms
const CLIENT_VERSION = '2.0.0'

export class OcterClient {
  // ---------------------------------------------------------------------------
  // Static: SDK runtime (like LarkClient.setRuntime / LarkClient.runtime)
  // ---------------------------------------------------------------------------

  /** @type {import('openclaw/plugin-sdk').PluginRuntime | undefined} */
  static _runtime = undefined

  /** @type {object | undefined} */
  static _globalConfig = undefined

  /**
   * Store the OpenClaw SDK runtime for use by all channel layers.
   * Called once during plugin registration.
   * @param {import('openclaw/plugin-sdk').PluginRuntime} runtime
   */
  static setRuntime(runtime) {
    OcterClient._runtime = runtime
  }

  /**
   * Access the stored SDK runtime.
   * @returns {import('openclaw/plugin-sdk').PluginRuntime}
   */
  static get runtime() {
    if (!OcterClient._runtime) {
      throw new Error('[octer-channel] SDK runtime not initialized. Was OcterClient.setRuntime() called?')
    }
    return OcterClient._runtime
  }

  /**
   * Store the global config for cross-module access.
   * @param {object} cfg
   */
  static setGlobalConfig(cfg) {
    OcterClient._globalConfig = cfg
  }

  /**
   * Access the stored global config.
   * @returns {object | undefined}
   */
  static get globalConfig() {
    return OcterClient._globalConfig
  }

  /** @type {object | undefined} */
  static _pluginConfig = undefined

  /**
   * Store the plugin config (from plugins.entries.octer-channel.config).
   * @param {object} config
   */
  static setPluginConfig(config) {
    OcterClient._pluginConfig = config
  }

  /**
   * Access the stored plugin config.
   * @returns {object | undefined}
   */
  static get pluginConfig() {
    return OcterClient._pluginConfig
  }

  // ---------------------------------------------------------------------------
  // Instance: WebSocket connection
  // ---------------------------------------------------------------------------

  /** @type {string} */
  apiKey

  /** @type {string} */
  accountId

  /** @type {WebSocket | null} */
  ws = null

  /** @type {NodeJS.Timeout | null} */
  #reconnectTimer = null

  /** @type {NodeJS.Timeout | null} */
  #pingInterval = null

  /** @type {boolean} */
  #stopped = false

  /** @type {((...args: unknown[]) => void)} */
  #log = console.info

  /** @type {((...args: unknown[]) => void)} */
  #error = console.error

  /** @type {((msg: object) => void) | null} */
  #onMessage = null

  /** @type {(() => void) | null} */
  #onConnected = null

  /**
   * @param {{ apiKey: string, accountId?: string, log?: (...args: unknown[]) => void, error?: (...args: unknown[]) => void }} opts
   */
  constructor(opts) {
    this.apiKey = opts.apiKey
    this.accountId = opts.accountId || 'default'
    if (opts.log) this.#log = opts.log
    if (opts.error) this.#error = opts.error
  }

  /**
   * Create an OcterClient from an API key.
   * @param {string} apiKey
   * @param {{ accountId?: string, log?: (...args: unknown[]) => void, error?: (...args: unknown[]) => void }} [opts]
   */
  static fromApiKey(apiKey, opts = {}) {
    return new OcterClient({ apiKey, ...opts })
  }

  /**
   * Build machine identification metadata.
   */
  static getMachineId() {
    const hostname = os.hostname()
    return {
      hostname,
      machineId: `${hostname}-${os.userInfo().username}`,
    }
  }

  /**
   * Start the WebSocket connection.
   * @param {{ onMessage: (msg: object) => void, onConnected?: () => void, abortSignal?: AbortSignal }} handlers
   * @returns {Promise<void>} Resolves when abortSignal fires or connection is stopped
   */
  startWS(handlers) {
    this.#onMessage = handlers.onMessage
    this.#onConnected = handlers.onConnected ?? null
    this.#stopped = false

    return new Promise((resolve) => {
      if (handlers.abortSignal) {
        if (handlers.abortSignal.aborted) {
          resolve()
          return
        }
        handlers.abortSignal.addEventListener('abort', () => {
          this.stop()
          resolve()
        }, { once: true })
      }

      this.#connect()
    })
  }

  /**
   * Establish a WebSocket connection to the Octer backend.
   */
  #connect() {
    if (this.#stopped) return

    // Clean up any existing connection before reconnecting
    if (this.ws) {
      try {
        this.ws.removeAllListeners()
        this.ws.close()
      } catch {}
      this.ws = null
    }

    const url = `${BACKEND_WS_URL}?api_key=${this.apiKey}`
    this.#log(`[octer-channel] Connecting to ${BACKEND_WS_URL} ...`)

    const socket = new WebSocket(url)
    this.ws = socket

    socket.on('open', () => {
      this.#log('[octer-channel] Connected to Octer.ai')
      if (socket.readyState !== WebSocket.OPEN) return

      // Send status message on connect
      const { hostname, machineId } = OcterClient.getMachineId()
      this.send({
        type: 'status',
        hostname,
        machine_id: machineId,
        client_version: CLIENT_VERSION,
        openclaw_status: 'online',
      })

      this.#onConnected?.()
    })

    socket.on('message', (data) => {
      let msg
      try {
        msg = JSON.parse(data.toString())
      } catch {
        this.#error('[octer-channel] Bad JSON from backend')
        return
      }
      this.#onMessage?.(msg)
    })

    socket.on('close', (code, reason) => {
      this.#log(`[octer-channel] Disconnected (code=${code}, reason=${reason || ''})`)
      if (this.ws === socket) this.ws = null
      this.#clearPing()
      this.#scheduleReconnect()
    })

    socket.on('error', (err) => {
      this.#error('[octer-channel] WebSocket error:', err.message)
    })

    this.#startPing(socket)
  }

  /**
   * Send a JSON message through the WebSocket.
   * @param {object} msg
   * @returns {boolean}
   */
  send(msg) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.#error('[octer-channel] Cannot send, WebSocket not connected')
      return false
    }
    this.ws.send(JSON.stringify(msg))
    return true
  }

  /** @param {WebSocket} socket */
  #startPing(socket) {
    this.#clearPing()
    this.#pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }))
      } else {
        this.#clearPing()
      }
    }, PING_INTERVAL)
  }

  #clearPing() {
    if (this.#pingInterval) {
      clearInterval(this.#pingInterval)
      this.#pingInterval = null
    }
  }

  #scheduleReconnect() {
    if (this.#stopped || this.#reconnectTimer) return
    this.#log(`[octer-channel] Reconnecting in ${RECONNECT_INTERVAL / 1000}s ...`)
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null
      this.#connect()
    }, RECONNECT_INTERVAL)
  }

  stop() {
    this.#stopped = true
    this.#clearPing()
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer)
      this.#reconnectTimer = null
    }
    if (this.ws) {
      try {
        this.ws.removeAllListeners()
        this.ws.close()
      } catch {}
      this.ws = null
    }
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
