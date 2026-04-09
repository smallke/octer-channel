---
name: octer-channel
version: 1.1.0
description: "Octer Channel — WebSocket bridge to Octer.ai. Enables remote tool execution via octer.ai cloud. Use when user mentions octer, octer-channel, or wants to connect to Octer.ai."
metadata:
  requires:
    bins: ["node"]
---

# Octer Channel

> **IMPORTANT**: You must configure your Octer.ai API Key before using this plugin.

> **CRITICAL — Agent Behavior**: Before performing any Octer-related action, check whether the API key is configured by running:
> ```bash
> openclaw config get plugins.entries.octer-channel.config.apiKey
> ```
> If the key is empty or missing, **stop and guide the user** through the configuration steps below. Do NOT attempt to start the gateway or use the Octer channel without a valid API key (starts with `evo_`).

## Setup

### 1. Install

```bash
openclaw plugins install octer-channel
```

Or from a local path:

```bash
openclaw plugins install /path/to/octer-channel
```

### 2. Configure API Key

Get your key from [octer.ai/workspace](https://octer.ai/workspace) → **Me** → **Settings** → **API Keys** → **Create Key**.

Your key starts with `evo_`. Set it with:

```bash
openclaw config set plugins.entries.octer-channel.config.apiKey "evo_YOUR_KEY"
```

### 3. Restart Gateway

```bash
openclaw gateway restart
```

### 4. Verify

```bash
openclaw channels status
```

You should see:

```
- Octer default (Octer): enabled, configured, running
```

## How It Works

The plugin connects to `wss://octer.ai/ws/bridge` via WebSocket and listens for `tool_request` messages from the Octer.ai cloud. Each request is dispatched to a local OpenClaw agent, and the result is sent back as a `tool_response`.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Channel shows "not configured" | Set API Key: `openclaw config set plugins.entries.octer-channel.config.apiKey "evo_..."` |
| WebSocket disconnects | Check network; auto-reconnects every 3s |
| `plugin not found` | Run `openclaw plugins install octer-channel` |
| Changes not taking effect | Run `openclaw gateway restart` |

## Standalone Mode

Run without the OpenClaw gateway:

```bash
echo "API_KEY=evo_your_key_here" > .env
npm start
```
