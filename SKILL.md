---
name: octer-channel
version: 1.0.0
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

### 3. Verify

```bash
openclaw plugins list
```

Confirm `octer-channel` is enabled and configured.

## How It Works

- The plugin connects to `wss://octer.ai/ws/bridge` via WebSocket
- It receives `tool_request` from the Octer cloud backend
- Executes the request locally via OpenClaw CLI
- Returns the result back to the cloud
- Auto-reconnects on disconnection

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
