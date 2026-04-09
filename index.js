/**
 * OpenClaw Octer channel plugin entry point.
 *
 * Following the openclaw-lark index.ts pattern:
 * - Registers the Octer channel via api.registerChannel()
 * - Stores SDK runtime and pluginConfig for cross-module access
 * - Exports public API for external consumers
 */

import { octerPlugin } from './src/channel/plugin.js'
import { OcterClient } from './src/core/octer-client.js'

// ---------------------------------------------------------------------------
// Re-exports for external consumers
// ---------------------------------------------------------------------------

export { monitorOcterProvider } from './src/channel/monitor.js'
export { octerPlugin } from './src/channel/plugin.js'
export { probeOcter } from './src/channel/probe.js'
export { sendToolResponse, octerOutbound, sendMessageOcter } from './src/messaging/outbound/outbound.js'
export { OcterClient } from './src/core/octer-client.js'

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin = {
  id: 'octer-channel',
  name: 'Octer Channel',
  description: 'WebSocket bridge to Octer.ai cloud backend',

  register(api) {
    // Store the SDK runtime for use by all channel layers
    if (api.runtime) {
      OcterClient.setRuntime(api.runtime)
    }

    // Store plugin config (from plugins.entries.octer-channel.config)
    // so the channel can read apiKey without needing channels.<id> section
    if (api.pluginConfig) {
      OcterClient.setPluginConfig(api.pluginConfig)
    }

    if (!api.pluginConfig?.apiKey) {
      api.logger?.warn?.('[octer-channel] No apiKey configured. Run: openclaw config set plugins.entries.octer-channel.config.apiKey "evo_YOUR_KEY"')
    }

    // Register the Octer channel plugin with the SDK
    api.registerChannel({ plugin: octerPlugin })
  },
}

export default plugin
