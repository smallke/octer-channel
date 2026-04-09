# Octer Channel

OpenClaw channel plugin — bridges your local OpenClaw agent to [Octer.ai](https://octer.ai) via WebSocket, enabling remote tool execution from the Octer.ai cloud.

## Quick Start

```bash
# 1. Install plugin
openclaw plugins install octer-channel

# 2. Set your API Key
openclaw config set plugins.entries.octer-channel.config.apiKey "evo_YOUR_KEY"

# 3. Restart gateway
openclaw gateway restart
```

## Get Your API Key

1. Visit [octer.ai/workspace](https://octer.ai/workspace)
2. Click **Me** → **Settings** → **API Keys** → **Create Key**
3. Copy the key (starts with `evo_`)

## Install from Local Path

For development or offline installation:

```bash
openclaw plugins install /path/to/octer-channel
```

## Verify

```bash
# Check plugin is loaded
openclaw plugins info octer-channel

# Check channel is configured and enabled
openclaw channels list

# Check channel is running (requires gateway)
openclaw channels status
```

Expected output:

```
- Octer default (Octer): enabled, configured, running
```

## Configuration

All configuration is stored in `~/.openclaw/openclaw.json` under `plugins.entries.octer-channel.config`:

```json
{
  "plugins": {
    "entries": {
      "octer-channel": {
        "enabled": true,
        "config": {
          "apiKey": "evo_your_key_here"
        }
      }
    }
  }
}
```

Set config via CLI:

```bash
# Set API Key
openclaw config set plugins.entries.octer-channel.config.apiKey "evo_YOUR_KEY"

# Enable / disable
openclaw plugins enable octer-channel
openclaw plugins disable octer-channel
```

## Standalone Mode

Run independently without the OpenClaw gateway:

```bash
echo "API_KEY=evo_your_key_here" > .env
npm start
```

## Architecture

```
Octer.ai Cloud  ←──WebSocket──→  octer-channel plugin  ←──CLI──→  OpenClaw Agent
                   (tool_request)                        (openclaw agent -m)
                   (tool_response)
```

The plugin receives `tool_request` messages from Octer.ai, dispatches each request to a local `openclaw agent` process, and sends the result back as `tool_response`.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Channel shows "not configured" | Set API Key: `openclaw config set plugins.entries.octer-channel.config.apiKey "evo_..."` |
| WebSocket keeps disconnecting | Check network; the plugin auto-reconnects every 3s |
| `plugin not found` | `openclaw plugins install octer-channel` |
| Gateway not picking up changes | `openclaw gateway restart` or kill & re-run |

## License

[MIT](LICENSE)
