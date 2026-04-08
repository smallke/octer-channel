import WebSocket from 'ws'
import os from 'os'
import { spawn } from 'child_process'

const BACKEND_WS_URL = 'wss://octer.ai/ws/bridge'
const OPENCLAW_CMD = 'openclaw'
const RECONNECT_INTERVAL = 3000 // ms

let apiKey = ''
let log = console
let ws = null
let reconnectTimer = null

export function start(config = {}) {
  apiKey = config.apiKey || process.env.API_KEY || ''
  if (config.logger) log = config.logger

  if (!apiKey) {
    log.error('[octer-channel] ERROR: API_KEY is required')
    return
  }

  connect()
}

function connect() {
  const hostname = os.hostname()
  const machineId = hostname + '-' + os.userInfo().username
  const url = `${BACKEND_WS_URL}?api_key=${apiKey}`
  log.info(`[octer-channel] Connecting to ${BACKEND_WS_URL} ...`)

  ws = new WebSocket(url)

  ws.on('open', () => {
    log.info('[octer-channel] Connected to cloud backend')
    // Send status message
    ws.send(JSON.stringify({
      type: 'status',
      hostname,
      machine_id: machineId,
      client_version: '1.0.0',
      openclaw_status: 'online',
    }))
  })

  ws.on('message', async (data) => {
    let msg
    try {
      msg = JSON.parse(data.toString())
    } catch {
      log.error('[octer-channel] Bad JSON from backend')
      return
    }

    if (msg.type === 'tool_request') {
      await handleToolRequest(msg)
    } else if (msg.type === 'pong') {
      // keepalive ack
    } else {
      log.info('[octer-channel] Unknown message type:', msg.type)
    }
  })

  ws.on('close', (code, reason) => {
    log.info(`[octer-channel] Disconnected (code=${code}, reason=${reason || ''})`)
    ws = null
    scheduleReconnect()
  })

  ws.on('error', (err) => {
    log.error('[octer-channel] WebSocket error:', err.message)
    // 'close' event will follow, which triggers reconnect
  })

  // Ping every 30s to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }))
    } else {
      clearInterval(pingInterval)
    }
  }, 30000)
}

function scheduleReconnect() {
  if (reconnectTimer) return
  log.info(`[octer-channel] Reconnecting in ${RECONNECT_INTERVAL / 1000}s ...`)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, RECONNECT_INTERVAL)
}

/**
 * Handle a tool_request from the cloud backend.
 * Execute the query via local OpenClaw and send back the result.
 */
async function handleToolRequest(msg) {
  const { request_id, tool_name, arguments: args } = msg
  const query = args?.query || ''

  log.info(`[octer-channel] tool_request id=${request_id} tool=${tool_name}`)
  log.info(`[octer-channel]   query: ${query.slice(0, 200)}`)

  try {
    const result = await executeOpenClaw(query)
    log.info(`[octer-channel] tool_response id=${request_id} success=true (${result.length} chars)`)
    sendResponse(request_id, result, null, true)
  } catch (err) {
    log.error(`[octer-channel] tool_response id=${request_id} error:`, err.message)
    sendResponse(request_id, null, err.message, false)
  }
}

function sendResponse(requestId, result, error, success) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log.error('[octer-channel] Cannot send response, WebSocket not connected')
    return
  }
  ws.send(JSON.stringify({
    type: 'tool_response',
    request_id: requestId,
    result,
    error,
    success,
  }))
}

/**
 * Execute a query via the local OpenClaw CLI.
 * Override OPENCLAW_CMD in .env to customize the command.
 */
function executeOpenClaw(query) {
  return new Promise((resolve, reject) => {
    const child = spawn(OPENCLAW_CMD, [query], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      timeout: 120000, // 2 min
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => { stdout += data.toString() })
    child.stderr.on('data', (data) => { stderr += data.toString() })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim() || '(no output)')
      } else {
        reject(new Error(stderr.trim() || `Process exited with code ${code}`))
      }
    })

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn ${OPENCLAW_CMD}: ${err.message}`))
    })

    child.stdin.end()
  })
}

// Standalone mode: run directly with `node src/index.js`
if (process.argv[1]?.endsWith('src/index.js')) {
  import('dotenv').then(d => { d.config?.(); start({ apiKey: process.env.API_KEY }) }).catch(() => start({ apiKey: process.env.API_KEY }))
}
