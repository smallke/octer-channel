/**
 * Standalone entry point for the Octer channel.
 *
 * Supports direct execution via `node src/index.js` without
 * the full OpenClaw SDK. Falls back to CLI-based execution
 * when the SDK runtime is not available.
 *
 * Delegates to the modular channel architecture:
 *   channel/monitor.js → channel/event-handlers.js → messaging/
 */

import { monitorOcterProvider } from './channel/monitor.js'

/**
 * Start the Octer channel bridge in standalone mode.
 *
 * @param {{ apiKey?: string, logger?: object }} [config]
 */
export function start(config = {}) {
  const apiKey = config.apiKey || process.env.API_KEY || ''
  const log = config.logger?.info?.bind(config.logger) ?? console.info
  const error = config.logger?.error?.bind(config.logger) ?? console.error

  if (!apiKey) {
    error('[octer-channel] ERROR: API_KEY is required')
    return
  }

  monitorOcterProvider({
    apiKey,
    runtime: { log, error },
  })
}

// Standalone mode: run directly with `node src/index.js`
if (process.argv[1]?.endsWith('src/index.js')) {
  import('dotenv')
    .then((d) => { d.config?.(); start({ apiKey: process.env.API_KEY }) })
    .catch(() => start({ apiKey: process.env.API_KEY }))
}
