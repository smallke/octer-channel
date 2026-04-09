/**
 * Channel type definitions for the Octer channel plugin.
 *
 * Following the openclaw-lark channel/types.ts pattern,
 * defines shared types used across monitor, event-handlers, and plugin.
 */

// ---------------------------------------------------------------------------
// Account types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} OcterAccount
 * @property {string} accountId
 * @property {string} apiKey
 * @property {boolean} enabled
 * @property {boolean} configured
 * @property {string} [name]
 */

// ---------------------------------------------------------------------------
// Monitor types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} MonitorOcterOpts
 * @property {string} [apiKey]
 * @property {object} [config] - ClawdbotConfig
 * @property {object} [runtime] - RuntimeEnv
 * @property {AbortSignal} [abortSignal]
 * @property {string} [accountId]
 */

/**
 * @typedef {Object} MonitorContext
 * @property {string} apiKey
 * @property {string} accountId
 * @property {import('../core/octer-client.js').OcterClient} client
 * @property {import('./chat-queue.js').RequestDedup} requestDedup
 * @property {object} [config] - ClawdbotConfig
 * @property {object} [runtime] - RuntimeEnv
 * @property {(...args: unknown[]) => void} log
 * @property {(...args: unknown[]) => void} error
 */

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ToolRequestMessage
 * @property {'tool_request'} type
 * @property {string} request_id
 * @property {string} tool_name
 * @property {{ query?: string }} [arguments]
 */

/**
 * @typedef {Object} ToolResponseMessage
 * @property {'tool_response'} type
 * @property {string} request_id
 * @property {string|null} result
 * @property {string|null} error
 * @property {boolean} success
 */

/**
 * @typedef {Object} StatusMessage
 * @property {'status'} type
 * @property {string} hostname
 * @property {string} machine_id
 * @property {string} client_version
 * @property {string} openclaw_status
 */

// ---------------------------------------------------------------------------
// Probe types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} OcterProbeResult
 * @property {boolean} ok
 * @property {string} [error]
 */

export {}
