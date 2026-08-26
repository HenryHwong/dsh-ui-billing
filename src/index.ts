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
import type { RpcResult } from '@deepseek-ai/dsh-host-apiproxy/api'
// Type-only: pulls the connection package's host Context merge (ctx.connection).
import type {} from '@deepseek-ai/dsh-client-connection'
import { fetchBalance, resolveBalanceRequest } from './balance.ts'
import { billingProjectionDefinition } from './projection.ts'
import type { ResolvedBillingConfig, TieredModelPrice } from './projection.ts'

/** Cordis plugin name. */
export const name = 'ui-billing'
/** Required services: the connection RPC registry (balance channel) and settings (provider facts). */
export const inject = ['connection', 'settings']

/** The balance channel this plugin owns; the browser half calls `balance` on it. */
export const BALANCE_CHANNEL = '/billing'

/**
 * Default CNY-per-million-token prices. The DeepSeek V3-era official rates
 * (deepseek-chat: ¥2/¥0.5/¥8, deepseek-reasoner: ¥4/¥1/¥16) are the verified
 * anchor; the V4 catalog mirrors them by tier (v4-pro at the reasoner rate,
 * v4-flash and its vision variant at the chat rate). Providing `config.prices`
 * replaces the whole table — prices are the deployment's responsibility and
 * must track the provider's current schedule (peak/off-peak windows included).
 */
const DEFAULT_PRICES: Record<string, TieredModelPrice> = {
  'deepseek-chat': { offPeak: { inputPerM: 2, cacheReadPerM: 0.5, outputPerM: 8 } },
  'deepseek-reasoner': { offPeak: { inputPerM: 4, cacheReadPerM: 1, outputPerM: 16 } },
  'deepseek-v4-flash': { offPeak: { inputPerM: 2, cacheReadPerM: 0.5, outputPerM: 8 } },
  'deepseek-v4-pro': { offPeak: { inputPerM: 4, cacheReadPerM: 1, outputPerM: 16 } },
  'deepseek-v4-flash-vision-exp': { offPeak: { inputPerM: 2, cacheReadPerM: 0.5, outputPerM: 8 } },
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
 * deployment's own (the fold reads it defensively). */
export const Config: z<Config> = z.object({
  prices: z.any().default(DEFAULT_PRICES),
  peakHours: z.any().default([]),
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
  const handler = async (endpoint: string, payload: unknown, signal: AbortSignal): Promise<RpcResult<unknown>> => {
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
  ctx.connection.rpc.handle(BALANCE_CHANNEL, handler, { authority: 'loopback' })

  const projections = ctx.get('sessionProjections')
  if (projections !== undefined) projections.register(billingProjectionDefinition(resolveBillingConfig(config)))
}
