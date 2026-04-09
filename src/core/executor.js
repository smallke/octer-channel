/**
 * OpenClaw CLI execution module.
 *
 * For the octer-channel bridge, each tool_request needs an independent
 * agent session. The CLI executor spawns a separate `openclaw agent`
 * process per request, avoiding session contention that occurs with
 * the SDK's shared-session dispatch.
 */

import { spawn } from 'child_process'

const OPENCLAW_CMD = 'openclaw'
const EXECUTION_TIMEOUT = 120000 // 2 min

/**
 * Execute a query via the local OpenClaw CLI.
 *
 * @param {string} query - The query to execute
 * @param {{ timeout?: number }} [opts]
 * @returns {Promise<string>} The stdout output
 */
export function executeOpenClaw(query, opts = {}) {
  const timeout = opts.timeout ?? EXECUTION_TIMEOUT

  return new Promise((resolve, reject) => {
    const child = spawn(OPENCLAW_CMD, ['agent', '--agent', 'main', '-m', query], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      env: {
        ...process.env,
        // Allow overriding the OpenClaw state directory via OPENCLAW_STATE_DIR
        // e.g. for ~/.qclaw instead of default ~/.openclaw
      },
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => { stdout += data.toString() })
    child.stderr.on('data', (data) => { stderr += data.toString() })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim() || '(no output)')
      } else {
        const detail = stderr.trim() || stdout.trim() || '(no output)'
        reject(new Error(`openclaw exited with code ${code}: ${detail}`))
      }
    })

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn ${OPENCLAW_CMD}: ${err.message}`))
    })

    child.stdin.end()
  })
}
