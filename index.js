import { start } from './src/index.js'

const plugin = {
  id: 'octer-channel',
  name: 'Octer Channel',
  description: 'WebSocket bridge to Octer.ai cloud backend',

  register(api) {
    const apiKey = api.pluginConfig?.apiKey
    if (!apiKey) {
      api.logger.warn('[octer-channel] No apiKey configured, skipping. Run: openclaw plugins config octer-channel')
      return
    }
    start({ apiKey, logger: api.logger })
  },
}

export default plugin
