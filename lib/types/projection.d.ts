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
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection';
/** Whole-log cost figures (the wire view is exactly these totals). */
export interface BillingTotals {
    /** Accumulated cost in CNY over priced usage-reporting steps. */
    cost: number;
    /** Tokens from usage-reporting steps whose model had no configured price. */
    unpricedTokens: number;
}
/** Fold state: the totals themselves (plain JSON per the unit contract). */
export type BillingState = BillingTotals;
/** Per-million-token price of one model, in CNY. */
export interface ModelPrice {
    /** CNY per million uncached input tokens. */
    inputPerM: number;
    /** CNY per million cache-hit input tokens; omitted when the provider does not bill them. */
    cacheReadPerM?: number;
    /** CNY per million cache-write input tokens; omitted when the provider does not bill them. */
    cacheWritePerM?: number;
    /** CNY per million output tokens. */
    outputPerM: number;
}
/** One model's price schedule; only `offPeak` is required to show any cost. */
export interface TieredModelPrice {
    /** Price during peak hours. */
    peak?: ModelPrice;
    /** Price outside peak hours. */
    offPeak?: ModelPrice;
}
/** Fully resolved billing configuration — the plugin's defaults already applied. */
export interface ResolvedBillingConfig {
    /** CNY-per-million-token prices by model id; models without an entry count as unpriced. */
    prices: Record<string, TieredModelPrice>;
    /** Peak-hour windows, each `[start, end]` in minutes since midnight of the price clock. */
    peakHours: [number, number][];
    /** Fixed UTC offset of the price clock in minutes. */
    utcOffsetMinutes: number;
}
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionMap {
        /** Whole-log cost in CNY and unpriced tokens; see {@link BillingTotals}. */
        billing: BillingTotals;
    }
    interface SessionProjectionStateMap {
        billing: BillingState;
    }
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
export declare function priceFor(tier: TieredModelPrice, time: number, cfg: ResolvedBillingConfig): ModelPrice | undefined;
/** Total reported tokens of one usage record — the unpriced-token count.
 * @param usage - the usage record from an `assistant/message` event.
 * @returns the sum of the billed usage fields, or 0 for an absent or malformed record.
 */
export declare function usageTokens(usage: unknown): number;
/** CNY cost of one usage record at one price (per-million rates).
 * @param usage - the usage record from an `assistant/message` event.
 * @param price - the applicable per-million-token rates.
 * @returns the fractional CNY cost of the billed tokens.
 */
export declare function usageCost(usage: unknown, price: ModelPrice): number;
/** The `billing` unit with its client view present — the shape the projection registry's `register` requires. */
export type BillingProjectionDefinition = Omit<ProjectionDefinition<'billing', BillingState>, 'wire'> & {
    wire: NonNullable<ProjectionDefinition<'billing', BillingState>['wire']>;
};
/** The `billing` unit for one resolved price table; the fold is a pure function of committed events.
 * @param config - the resolved price table and peak windows.
 * @returns the projection definition to register on `ctx.sessionProjections`.
 */
export declare function billingProjectionDefinition(config: ResolvedBillingConfig): BillingProjectionDefinition;
//# sourceMappingURL=projection.d.ts.map