/**
 * The `billing` projection unit owned by the plugin: a pure fold of
 * `assistant/message` usage records into whole-log cost and unpriced-token
 * totals. Each usage-reporting step is priced by its assembled message's
 * `source.model` against the price table captured at composition load; a
 * model without an entry (or a tier without a price for the usage instant)
 * contributes its tokens to `unpricedTokens` instead of pretending they are
 * free. The provider output figure already includes reasoning tokens, so only
 * the four billed usage fields are priced.
 *
 * @module @huanghanheng/dsh-ui-billing/projection
 */

import { z } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { SessionEvent } from '@deepseek-ai/dsh-session'

/** Whole-log cost figures (the wire view is exactly these totals). */
export interface BillingTotals {
  /** Accumulated cost in CNY over priced usage-reporting steps. */
  cost: number
  /** Tokens from usage-reporting steps whose model had no configured price. */
  unpricedTokens: number
}

/** Fold state: the totals themselves (plain JSON per the unit contract). */
export type BillingState = BillingTotals

/** Per-million-token price of one model, in CNY. */
export interface ModelPrice {
  /** CNY per million uncached input tokens. */
  inputPerM: number
  /** CNY per million cache-hit input tokens; omitted when the provider does not bill them. */
  cacheReadPerM?: number
  /** CNY per million cache-write input tokens; omitted when the provider does not bill them. */
  cacheWritePerM?: number
  /** CNY per million output tokens. */
  outputPerM: number
}

/** One model's price schedule; only `offPeak` is required to show any cost. */
export interface TieredModelPrice {
  /** Price during peak hours. */
  peak?: ModelPrice
  /** Price outside peak hours. */
  offPeak?: ModelPrice
}

/** Fully resolved billing configuration — the plugin's defaults already applied. */
export interface ResolvedBillingConfig {
  /** CNY-per-million-token prices by model id; models without an entry count as unpriced. */
  prices: Record<string, TieredModelPrice>
  /** Peak-hour windows, each `[start, end]` in minutes since midnight of the price clock. */
  peakHours: [number, number][]
  /** Fixed UTC offset of the price clock in minutes. */
  utcOffsetMinutes: number
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Whole-log cost in CNY and unpriced tokens; see {@link BillingTotals}. */
    billing: BillingTotals
  }
  interface SessionProjectionStateMap {
    billing: BillingState
  }
}

const billingSchema = z.object({
  cost: z.number().nonnegative(),
  unpricedTokens: z.number().int().nonnegative(),
}).strict()

/** Local minutes-since-midnight of a UTC epoch-millisecond instant on the price clock. */
function localMinutes(time: number, utcOffsetMinutes: number): number {
  const daySeconds = ((Math.floor(time / 1000) + utcOffsetMinutes * 60) % 86400 + 86400) % 86400
  return Math.floor(daySeconds / 60)
}

/** Whether `minutes` falls inside `[start, end)`; a reversed window wraps midnight. */
function inWindow(minutes: number, start: number, end: number): boolean {
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

/**
 * The peak-or-off-peak price for one usage instant. Peak applies only when a
 * peak price exists and the instant falls inside a configured peak window;
 * everything else uses `offPeak` (the only tier required to show any cost).
 * @param tier - the model's price schedule.
 * @param time - the usage event's epoch-millisecond time.
 * @param cfg - the resolved billing configuration (windows and clock).
 * @returns the applicable price, or undefined when the tier has none.
 */
export function priceFor(tier: TieredModelPrice, time: number, cfg: ResolvedBillingConfig): ModelPrice | undefined {
  const peak = tier.peak
  const windows = cfg.peakHours
  const inPeak = peak !== undefined && windows.length > 0
    && windows.some(([start, end]) => inWindow(localMinutes(time, cfg.utcOffsetMinutes), start, end))
  return inPeak ? peak : tier.offPeak
}

/** Non-negative finite numeric field reader; unknown or invalid values read as 0. */
function tokensOf(usage: Record<string, unknown>, key: string): number {
  const value = usage[key]
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** Total reported tokens of one usage record — the unpriced-token count.
 * @param usage - the usage record from an `assistant/message` event.
 * @returns the sum of the billed usage fields, or 0 for an absent or malformed record.
 */
export function usageTokens(usage: unknown): number {
  if (typeof usage !== 'object' || usage === null) return 0
  const record = usage as Record<string, unknown>
  let total = 0
  for (const key of ['inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens'] as const) {
    total += tokensOf(record, key)
  }
  return total
}

/** CNY cost of one usage record at one price (per-million rates).
 * @param usage - the usage record from an `assistant/message` event.
 * @param price - the applicable per-million-token rates.
 * @returns the fractional CNY cost of the billed tokens.
 */
export function usageCost(usage: unknown, price: ModelPrice): number {
  if (typeof usage !== 'object' || usage === null) return 0
  const record = usage as Record<string, unknown>
  let cost = tokensOf(record, 'inputTokens') * price.inputPerM
  if (price.cacheReadPerM !== undefined) cost += tokensOf(record, 'cacheReadTokens') * price.cacheReadPerM
  if (price.cacheWritePerM !== undefined) cost += tokensOf(record, 'cacheWriteTokens') * price.cacheWritePerM
  cost += tokensOf(record, 'outputTokens') * price.outputPerM
  return cost / 1_000_000
}

/** The `billing` unit with its client view present — the shape the projection registry's `register` requires. */
export type BillingProjectionDefinition =
  & Omit<ProjectionDefinition<'billing', BillingState>, 'wire'>
  & { wire: NonNullable<ProjectionDefinition<'billing', BillingState>['wire']> }

/** The `billing` unit for one resolved price table; the fold is a pure function of committed events.
 * @param config - the resolved price table and peak windows.
 * @returns the projection definition to register on `ctx.sessionProjections`.
 */
export function billingProjectionDefinition(config: ResolvedBillingConfig): BillingProjectionDefinition {
  return {
    key: 'billing',
    // Persisted cache rows are keyed by this version alongside the session and
    // key, so bumping it discards rows folded under older semantics or prices
    // and every session refolds from its log on the next read.
    stateVersion: 4,
    stateSchema: billingSchema,
    init: (): BillingState => ({ cost: 0, unpricedTokens: 0 }),
    apply: (state: BillingState, event: SessionEvent): BillingState => {
      if (event.type !== 'assistant/message') return state
      const usage = event.data.usage
      if (usage === undefined) return state
      const model = event.data.message.source?.model
      const tier = typeof model === 'string' ? config.prices?.[model] : undefined
      const price = tier === undefined ? undefined : priceFor(tier, event.time, config)
      if (price === undefined) {
        const tokens = usageTokens(usage)
        return tokens === 0 ? state : { ...state, unpricedTokens: state.unpricedTokens + tokens }
      }
      const cost = usageCost(usage, price)
      return cost === 0 ? state : { ...state, cost: state.cost + cost }
    },
    wire: {
      viewSchema: billingSchema,
      view: (state: BillingState): BillingTotals => ({ cost: state.cost, unpricedTokens: state.unpricedTokens }),
    },
  }
}
