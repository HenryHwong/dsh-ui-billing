/**
 * Billing surface plugin, node half: registers the `billing` session
 * projection (whole-log CNY cost against the price table captured at
 * composition load) and serves the provider account balance to the browser
 * half over the `/billing` connection RPC channel. The browser half ships via
 * exports["./client"], discovered through the package.json `dsh.client`
 * declaration.
 *
 * @module @huanghanheng/dsh-ui-billing
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { fetchBalance, resolveBalanceRequest } from './balance.ts'
import { billingProjectionDefinition } from './projection.ts'
import type { ResolvedBillingConfig, TieredModelPrice } from './projection.ts'
import { registerRpcChannel } from './seams/connection.ts'
import type { ConnectionRpcHandler } from './seams/connection.ts'

/** Cordis plugin name. */
export const name = 'ui-billing'
/** Required services: connection (RPC registry), settings (provider facts), and session projections are probed dynamically; webServer is injected at registration time. */
export const inject = ['connection', 'settings']

/** The balance channel this plugin owns; the browser half calls `balance` on it. */
export const BALANCE_CHANNEL = '/billing'

/**
 * Default CNY-per-million-token prices. The V4 catalog follows the official
 * schedule as of the plugin release (off-peak rates, with the workday peak
 * windows in `Config` doubling them); the deepseek-chat / deepseek-reasoner
 * entries are the legacy V3 anchors kept for older usage records. Providing
 * `config.prices` replaces the whole table — prices are the deployment's
 * responsibility and must track the provider's current schedule.
 */
const DEFAULT_PRICES: Record<string, TieredModelPrice> = {
  'deepseek-chat': { offPeak: { inputPerM: 2, cacheReadPerM: 0.5, outputPerM: 8 } },
  'deepseek-reasoner': { offPeak: { inputPerM: 4, cacheReadPerM: 1, outputPerM: 16 } },
  'deepseek-v4-flash': {
    offPeak: { inputPerM: 1, cacheReadPerM: 0.02, outputPerM: 4 },
    peak: { inputPerM: 2, cacheReadPerM: 0.04, outputPerM: 8 },
  },
  'deepseek-v4-pro': {
    offPeak: { inputPerM: 4.5, cacheReadPerM: 0.15, outputPerM: 13.5 },
    peak: { inputPerM: 9, cacheReadPerM: 0.3, outputPerM: 27 },
  },
  'deepseek-v4-flash-vision-exp': {
    offPeak: { inputPerM: 1, cacheReadPerM: 0.02, outputPerM: 4 },
    peak: { inputPerM: 2, cacheReadPerM: 0.04, outputPerM: 8 },
  },
}

/** Billing configuration as validated and defaulted by the Loader. */
export interface Config {
  /** CNY-per-million-token prices by model id; missing models count as unpriced. */
  prices: Record<string, TieredModelPrice>
  /** Peak-hour windows, each `[start, end]` in minutes since midnight of the price clock. */
  peakHours: [number, number][]
  /** Fixed UTC offset of the price clock in minutes. */
  utcOffsetMinutes: number
}

/** Loader schema; a missing field falls back to the shipped defaults. The
 * price table passes through `z.any()` because its nested shape is the
 * deployment's own (the fold reads it defensively). The default peak windows
 * are the official Beijing workday schedule (09:00-12:00, 14:00-18:00); the
 * window model cannot exclude weekends, so deployments may clear `peakHours`
 * to price everything off-peak. */
export const Config: z<Config> = z.object({
  prices: z.any().default(DEFAULT_PRICES),
  peakHours: z.any().default([[540, 720], [840, 1080]]),
  utcOffsetMinutes: z.number().step(1).default(480),
})

/** Resolve the plugin's config to the projection's closed form. */
function resolveBillingConfig(config: Config | undefined): ResolvedBillingConfig {
  const resolved = Config((config ?? {}) as Config)
  return {
    prices: resolved.prices,
    peakHours: resolved.peakHours,
    utcOffsetMinutes: resolved.utcOffsetMinutes,
  }
}

/**
 * Host plugin body: register the balance endpoint on the `/billing` channel
 * and, when the composition mounts the projection registry, the `billing`
 * cost unit (its registration is an effect on this fiber, so unloading
 * removes the key).
 * @param ctx - registrant context carrying the connection and settings services.
 * @param config - the deployment's price table and peak windows.
 */
export function apply(ctx: Context, config?: Config): void {
  const handler: ConnectionRpcHandler = async (endpoint, payload, signal) => {
    if (endpoint !== 'balance') {
      return {
        ok: false,
        error: { code: 'internal', message: `ui-billing: unknown endpoint "${endpoint}"`, details: {} },
      }
    }
    const candidate = (payload as { provider?: unknown } | undefined)?.provider
    const provider = typeof candidate === 'string' && candidate.length > 0 ? candidate : 'deepseek-official'
    try {
      const request = await resolveBalanceRequest(ctx, provider)
      const balance = await fetchBalance(request, signal)
      return { ok: true, value: { balance } }
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          code: 'internal',
          message: error instanceof Error ? error.message : String(error),
          details: { provider },
        },
      }
    }
  }
  registerRpcChannel(ctx, BALANCE_CHANNEL, handler)

  const projections = ctx.get('sessionProjections')
  if (projections !== undefined) projections.register(billingProjectionDefinition(resolveBillingConfig(config)))
}
