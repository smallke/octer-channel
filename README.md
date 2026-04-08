# Octer Channel

OpenClaw plugin that bridges your local machine to the [Octer.ai](https://octer.ai) cloud backend via WebSocket, enabling remote tool execution.

## Quick Start

```bash
# 1. Install
openclaw plugins install octer-channel

# 2. Configure API Key
openclaw plugins config octer-channel --set apiKey=YOUR_API_KEY

# 3. Allow plugin
openclaw config set plugins.allow '["octer-channel"]'

# 4. Verify
openclaw plugins list
```

## Get Your API Key

1. Go to [octer.ai/workspace](https://octer.ai/workspace)
2. Click **Me** => **Settings** => **API Keys** => **Create Key**
3. Your key starts with `evo_`

## Allow Plugin

Non-bundled plugins require explicit trust. Add `octer-channel` to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "allow": ["octer-channel"]
  }
}
```

## Standalone Mode

You can also run it independently without the OpenClaw plugin system:

```bash
echo "API_KEY=evo_your_key_here" > .env
node src/index.js
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `API_KEY is required` | `openclaw plugins config octer-channel --set apiKey=YOUR_KEY` |
| WebSocket keeps disconnecting | Check network; the plugin auto-reconnects every 3s |
| `plugin not found` | `openclaw plugins install octer-channel` |
| `plugins.allow is empty` | Add `"allow": ["octer-channel"]` to plugins config |

## License

[MIT](LICENSE)
