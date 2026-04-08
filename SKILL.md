---
name: octer-channel
version: 1.0.2
description: "Octer Channel - WebSocket bridge to Octer.ai cloud backend. Enables remote tool execution via octer.ai. Use when user mentions octer, octer-channel, or wants to connect to octer.ai cloud."
metadata:
  requires:
    bins: ["node"]
---

# Octer Channel

> **CRITICAL** Before using this plugin, you must configure your Octer API Key.

## Setup

### 1. Install

```bash
openclaw plugins install octer-channel
```

### 2. Configure API Key

You **must** set your API Key before the plugin can work:

```bash
openclaw plugins config octer-channel --set apiKey=YOUR_API_KEY
```

API Key starts with `evo_`, you can get it from [octer.ai](https://octer.ai/workspace) click me => settings  => API Keys  => Create Key.

### 3. Allow Plugin

Add `octer-channel` to the plugins allow list in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "allow": ["octer-channel"]
  }
}
```

Or run:

```bash
openclaw config set plugins.allow '["octer-channel"]'
```

### 4. Verify

```bash
openclaw plugins list
```

Confirm `octer-channel` is enabled and configured.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `API_KEY is required` | Run `openclaw plugins config octer-channel --set apiKey=YOUR_KEY` |
| WebSocket keeps disconnecting | Check network connection; the plugin will auto-reconnect every 3s |
| `plugin not found` | Run `openclaw plugins install octer-channel` first |

## Standalone Mode

You can also run it independently without OpenClaw plugin system:

```bash
# Set API_KEY in .env file
echo "API_KEY=evo_your_key_here" > .env
node src/index.js
```
