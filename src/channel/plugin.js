/**
 * ChannelPlugin interface implementation for the Octer channel.
 *
 * Following the openclaw-lark channel/plugin.ts pattern, this is the
 * top-level entry point that the OpenClaw plugin system uses to discover
 * capabilities, resolve accounts, obtain outbound adapters, and start
 * the inbound event gateway.
 */

import { probeOcter } from './probe.js'
import { octerOutbound } from '../messaging/outbound/outbound.js'
import { OcterClient } from '../core/octer-client.js'

const DEFAULT_ACCOUNT_ID = 'default'

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  id: 'octer',
  label: 'Octer',
  selectionLabel: 'Octer.ai',
  docsPath: '/channels/octer',
  docsLabel: 'octer',
  blurb: 'WebSocket bridge to Octer.ai cloud backend.',
  aliases: [],
  order: 100,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve an OcterAccount from config.
 *
 * Third-party plugins read config from plugins.entries.<id>.config
 * (stored in OcterClient.pluginConfig), not from channels.<id>.
 *
 * @param {object} cfg - ClawdbotConfig
 * @param {string} [accountId]
 * @returns {import('./types.js').OcterAccount}
 */
function getOcterAccount(cfg, accountId) {
  const id = accountId || DEFAULT_ACCOUNT_ID
  const pluginCfg = OcterClient.pluginConfig || {}
  const apiKey = pluginCfg.apiKey || ''
  return {
    accountId: id,
    apiKey,
    enabled: !!apiKey,
    configured: !!apiKey,
    name: pluginCfg.name || 'Octer',
  }
}

// ---------------------------------------------------------------------------
// Channel plugin definition
// ---------------------------------------------------------------------------

/** @type {import('openclaw/plugin-sdk').ChannelPlugin} */
export const octerPlugin = {
  id: 'octer',

  meta: { ...meta },

  // -------------------------------------------------------------------------
  // Capabilities
  // -------------------------------------------------------------------------

  capabilities: {
    chatTypes: ['direct'],
    media: false,
    reactions: false,
    threads: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: false,
  },

  // -------------------------------------------------------------------------
  // Agent prompt
  // -------------------------------------------------------------------------

  agentPrompt: {
    messageToolHints: () => [
      '- Octer channel: messages are routed through the Octer.ai cloud bridge.',
      '- Media is not supported natively; URLs are sent as text.',
    ],
  },

  // -------------------------------------------------------------------------
  // Reload
  // -------------------------------------------------------------------------

  reload: { configPrefixes: ['plugins.entries.octer-channel.config'] },

  // -------------------------------------------------------------------------
  // Config schema (JSON Schema)
  // -------------------------------------------------------------------------

  configSchema: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        apiKey: {
          type: 'string',
          description: 'Octer.ai API key (starts with evo_)',
        },
        name: {
          type: 'string',
          description: 'Display name for this account',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // Config adapter
  // -------------------------------------------------------------------------

  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],

    resolveAccount: (cfg, accountId) => getOcterAccount(cfg, accountId),

    defaultAccountId: () => DEFAULT_ACCOUNT_ID,

    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      // Single-account: toggle by presence of apiKey
      return cfg
    },

    deleteAccount: ({ cfg, accountId }) => {
      return cfg
    },

    isConfigured: (account) => account.configured,

    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      name: account.name,
    }),

    resolveAllowFrom: () => {
      const pluginCfg = OcterClient.pluginConfig || {}
      return pluginCfg.allowFrom ?? []
    },

    formatAllowFrom: ({ allowFrom }) =>
      allowFrom.map((e) => String(e).trim()).filter(Boolean),
  },

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  setup: {
    resolveAccountId: () => DEFAULT_ACCOUNT_ID,
    applyAccountConfig: ({ cfg }) => cfg,
  },

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  messaging: {
    normalizeTarget: (raw) => raw || undefined,
    targetResolver: {
      looksLikeId: (raw) => typeof raw === 'string' && raw.length > 0,
      hint: '<requestId>',
    },
  },

  // -------------------------------------------------------------------------
  // Directory
  // -------------------------------------------------------------------------

  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
    listPeersLive: async () => [],
    listGroupsLive: async () => [],
  },

  // -------------------------------------------------------------------------
  // Outbound
  // -------------------------------------------------------------------------

  outbound: octerOutbound,

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      port: null,
    },

    probeAccount: async ({ account }) => {
      return await probeOcter({ apiKey: account.apiKey })
    },

    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      name: account.name,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      port: runtime?.port ?? null,
      probe,
    }),
  },

  // -------------------------------------------------------------------------
  // Gateway
  // -------------------------------------------------------------------------

  gateway: {
    startAccount: async (ctx) => {
      const account = getOcterAccount(ctx.cfg, ctx.accountId)

      if (!account.apiKey) {
        ctx.log?.warn?.(`[octer-channel] No apiKey configured, skipping. Run: openclaw config set plugins.entries.octer-channel.config.apiKey "evo_YOUR_KEY"`)
        return
      }

      const { monitorOcterProvider } = await import('./monitor.js')
      ctx.setStatus?.({ accountId: ctx.accountId })
      ctx.log?.info?.(`starting octer[${ctx.accountId}]`)

      return monitorOcterProvider({
        apiKey: account.apiKey,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        accountId: ctx.accountId,
      })
    },

    stopAccount: async (ctx) => {
      ctx.log?.info?.(`stopping octer[${ctx.accountId}]`)
      ctx.log?.info?.(`stopped octer[${ctx.accountId}]`)
    },
  },
}
