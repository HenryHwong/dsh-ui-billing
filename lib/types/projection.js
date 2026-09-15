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
import { z } from 'zod';
const billingSchema = z.object({
    cost: z.number().nonnegative(),
    unpricedTokens: z.number().int().nonnegative(),
}).strict();
/** Local minutes-since-midnight of a UTC epoch-millisecond instant on the price clock. */
function localMinutes(time, utcOffsetMinutes) {
    const daySeconds = ((Math.floor(time / 1000) + utcOffsetMinutes * 60) % 86400 + 86400) % 86400;
    return Math.floor(daySeconds / 60);
}
/** Whether `minutes` falls inside `[start, end)`; a reversed window wraps midnight. */
function inWindow(minutes, start, end) {
    return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
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
export function priceFor(tier, time, cfg) {
    const peak = tier.peak;
    const windows = cfg.peakHours;
    const inPeak = peak !== undefined && windows.length > 0
        && windows.some(([start, end]) => inWindow(localMinutes(time, cfg.utcOffsetMinutes), start, end));
    return inPeak ? peak : tier.offPeak;
}
/** Non-negative finite numeric field reader; unknown or invalid values read as 0. */
function tokensOf(usage, key) {
    const value = usage[key];
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}
/** Total reported tokens of one usage record — the unpriced-token count.
 * @param usage - the usage record from an `assistant/message` event.
 * @returns the sum of the billed usage fields, or 0 for an absent or malformed record.
 */
export function usageTokens(usage) {
    if (typeof usage !== 'object' || usage === null)
        return 0;
    const record = usage;
    let total = 0;
    for (const key of ['inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens']) {
        total += tokensOf(record, key);
    }
    return total;
}
/** CNY cost of one usage record at one price (per-million rates).
 * @param usage - the usage record from an `assistant/message` event.
 * @param price - the applicable per-million-token rates.
 * @returns the fractional CNY cost of the billed tokens.
 */
export function usageCost(usage, price) {
    if (typeof usage !== 'object' || usage === null)
        return 0;
    const record = usage;
    let cost = tokensOf(record, 'inputTokens') * price.inputPerM;
    if (price.cacheReadPerM !== undefined)
        cost += tokensOf(record, 'cacheReadTokens') * price.cacheReadPerM;
    if (price.cacheWritePerM !== undefined)
        cost += tokensOf(record, 'cacheWriteTokens') * price.cacheWritePerM;
    cost += tokensOf(record, 'outputTokens') * price.outputPerM;
    return cost / 1_000_000;
}
/** The `billing` unit for one resolved price table; the fold is a pure function of committed events.
 * @param config - the resolved price table and peak windows.
 * @returns the projection definition to register on `ctx.sessionProjections`.
 */
export function billingProjectionDefinition(config) {
    return {
        key: 'billing',
        // Persisted cache rows are keyed by this version alongside the session and
        // key, so bumping it discards rows folded under older semantics or prices
        // and every session refolds from its log on the next read.
        stateVersion: 5,
        stateSchema: billingSchema,
        init: () => ({ cost: 0, unpricedTokens: 0 }),
        apply: (state, event) => {
            if (event.type !== 'assistant/message')
                return state;
            const usage = event.data.usage;
            if (usage === undefined)
                return state;
            const model = event.data.message.source?.model;
            const tier = typeof model === 'string' ? config.prices?.[model] : undefined;
            const price = tier === undefined ? undefined : priceFor(tier, event.time, config);
            if (price === undefined) {
                const tokens = usageTokens(usage);
                return tokens === 0 ? state : { ...state, unpricedTokens: state.unpricedTokens + tokens };
            }
            const cost = usageCost(usage, price);
            return cost === 0 ? state : { ...state, cost: state.cost + cost };
        },
        wire: {
            viewSchema: billingSchema,
            view: (state) => ({ cost: state.cost, unpricedTokens: state.unpricedTokens }),
        },
    };
}
//# sourceMappingURL=projection.js.map