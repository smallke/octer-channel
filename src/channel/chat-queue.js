/**
 * Process-level request task queue.
 *
 * Following the openclaw-lark channel/chat-queue.ts pattern,
 * ensures tasks targeting the same request context are executed serially.
 * Prevents concurrent tool_request handling from causing race conditions.
 *
 * Consumers: monitor.js, event-handlers.js
 */

/** @typedef {'queued' | 'immediate'} QueueStatus */

/**
 * @typedef {Object} ActiveDispatcherEntry
 * @property {() => Promise<void>} abort
 * @property {AbortController} [abortController]
 */

/** @type {Map<string, Promise<void>>} */
const requestQueues = new Map()

/** @type {Map<string, ActiveDispatcherEntry>} */
const activeDispatchers = new Map()

/**
 * Simple request deduplication tracker.
 * Prevents processing duplicate requests from WebSocket reconnects.
 */
export class RequestDedup {
  /** @type {Map<string, number>} */
  #seen = new Map()
  #ttlMs
  #maxEntries

  /** @param {{ ttlMs?: number, maxEntries?: number }} [opts] */
  constructor(opts = {}) {
    this.#ttlMs = opts.ttlMs ?? 60000
    this.#maxEntries = opts.maxEntries ?? 1000
  }

  /**
   * Try to record a request ID. Returns false if already seen (duplicate).
   * @param {string} requestId
   * @returns {boolean}
   */
  tryRecord(requestId) {
    this.#cleanup()
    if (this.#seen.has(requestId)) return false
    this.#seen.set(requestId, Date.now())
    return true
  }

  #cleanup() {
    if (this.#seen.size <= this.#maxEntries) return
    const now = Date.now()
    for (const [key, ts] of this.#seen) {
      if (now - ts > this.#ttlMs) this.#seen.delete(key)
    }
  }
}

/**
 * Build a queue key for a given account and request.
 * @param {string} accountId
 * @param {string} requestId
 * @returns {string}
 */
export function buildQueueKey(accountId, requestId) {
  return `${accountId}:${requestId}`
}

/**
 * @param {string} key
 * @param {ActiveDispatcherEntry} entry
 */
export function registerActiveDispatcher(key, entry) {
  activeDispatchers.set(key, entry)
}

/** @param {string} key */
export function unregisterActiveDispatcher(key) {
  activeDispatchers.delete(key)
}

/** @param {string} key */
export function getActiveDispatcher(key) {
  return activeDispatchers.get(key)
}

/** @param {string} key */
export function hasActiveTask(key) {
  return requestQueues.has(key)
}

/**
 * Enqueue a task for serial execution.
 * @param {{ accountId: string, requestId: string, task: () => Promise<void> }} params
 * @returns {{ status: QueueStatus, promise: Promise<void> }}
 */
export function enqueueTask(params) {
  const { accountId, requestId, task } = params
  const key = buildQueueKey(accountId, requestId)
  const prev = requestQueues.get(key) ?? Promise.resolve()
  /** @type {QueueStatus} */
  const status = requestQueues.has(key) ? 'queued' : 'immediate'

  const taskPromise = prev.then(task, task)
  requestQueues.set(key, taskPromise)

  const cleanup = () => {
    if (requestQueues.get(key) === taskPromise) requestQueues.delete(key)
  }
  taskPromise.then(cleanup, cleanup)

  return { status, promise: taskPromise }
}

/** @internal Test-only: reset all queue and dispatcher state. */
export function _resetQueueState() {
  requestQueues.clear()
  activeDispatchers.clear()
}
