/**
 * Credential validation for the Octer channel.
 *
 * Following the openclaw-lark channel/probe.ts pattern,
 * validates that the API key is present and well-formed.
 *
 * @param {{ apiKey?: string }} [credentials]
 * @returns {Promise<import('./types.js').OcterProbeResult>}
 */
export async function probeOcter(credentials) {
  if (!credentials?.apiKey) {
    return { ok: false, error: 'missing credentials (apiKey)' }
  }

  if (!credentials.apiKey.startsWith('evo_')) {
    return { ok: false, error: 'invalid apiKey format (expected evo_...)' }
  }

  return { ok: true }
}
