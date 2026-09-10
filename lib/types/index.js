/**
 * Billing surface plugin, node half: registers the `billing` session
 * projection (whole-log CNY cost against the price table captured at
 * composition load) and serves the provider account balance to the browser
 * half over the `/api/billing.balance` endpoint. The browser half ships via
 * exports["./client"], discovered through the package.json `dsh.client`
 * declaration.
 *
 * @module @huanghanheng/dsh-ui-billing
 */
import z from '@deepseek-ai/schemastery';
import { LlmError, QUOTA_EXCEEDED_CODE } from '@deepseek-ai/dsh-llm';
import { fetchBalance, resolveBalanceRequest } from "./balance.js";
import { billingProjectionDefinition } from "./projection.js";
import { registerPostEndpoint } from "./seams/connection.js";
/** Cordis plugin name. */
export const name = 'ui-billing';
/** Required services: connection (endpoint transport) and settings (provider facts); session projections are probed dynamically. */
export const inject = ['connection', 'settings'];
/** The balance endpoint this plugin owns; the browser half fetches the same literal. */
export const BALANCE_PATH = '/api/billing.balance';
/** Provider route read when a request names none. */
const DEFAULT_PROVIDER = 'deepseek-official';
/**
 * Default CNY-per-million-token prices. The V4 catalog follows the official
 * schedule as of the plugin release (off-peak rates, with the workday peak
 * windows in `Config` doubling them); the deepseek-chat / deepseek-reasoner
 * entries are the legacy V3 anchors kept for older usage records. Providing
 * `config.prices` replaces the whole table — prices are the deployment's
 * responsibility and must track the provider's current schedule.
 */
const DEFAULT_PRICES = {
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
};
/** Loader schema; a missing field falls back to the shipped defaults. The
 * price table passes through `z.any()` because its nested shape is the
 * deployment's own (the fold reads it defensively). The default peak windows
 * are the official Beijing workday schedule (09:00-12:00, 14:00-18:00); the
 * window model cannot exclude weekends, so deployments may clear `peakHours`
 * to price everything off-peak. */
export const Config = z.object({
    prices: z.any().default(DEFAULT_PRICES),
    peakHours: z.any().default([[540, 720], [840, 1080]]),
    utcOffsetMinutes: z.number().step(1).default(480),
});
/** Resolve the plugin's config to the projection's closed form. */
function resolveBillingConfig(config) {
    const resolved = Config((config ?? {}));
    return {
        prices: resolved.prices,
        peakHours: resolved.peakHours,
        utcOffsetMinutes: resolved.utcOffsetMinutes,
    };
}
/** JSON response carrying `body` at `status`. */
function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
/** The provider route one request names; an absent or malformed body selects the default route. */
async function requestedProvider(request) {
    try {
        const body = await request.json();
        return typeof body.provider === 'string' && body.provider.length > 0 ? body.provider : DEFAULT_PROVIDER;
    }
    catch {
        return DEFAULT_PROVIDER;
    }
}
/** HTTP status for one failed read; provider codes keep their transport meaning. */
function errorStatus(error) {
    const code = error instanceof LlmError ? error.code : undefined;
    if (code === 'MISSING_CREDENTIAL' || code === 'AUTH')
        return 401;
    if (code === QUOTA_EXCEEDED_CODE || code === 'RATE_LIMIT')
        return 429;
    if (code === 'INVALID_REQUEST')
        return 400;
    return 502;
}
/**
 * Host plugin body: register the balance endpoint and, when the composition
 * mounts the projection registry, the `billing` cost unit (its registration is
 * an effect on this fiber, so unloading removes the key).
 * @param ctx - registrant context carrying the connection and settings services.
 * @param config - the deployment's price table and peak windows.
 */
export function apply(ctx, config) {
    const endpoint = async (request) => {
        const provider = await requestedProvider(request);
        try {
            const balance = await fetchBalance(await resolveBalanceRequest(ctx, provider), request.signal);
            return jsonResponse(200, { balance });
        }
        catch (error) {
            return jsonResponse(errorStatus(error), {
                error: {
                    code: error instanceof LlmError ? error.code : 'internal',
                    message: error instanceof Error ? error.message : String(error),
                },
            });
        }
    };
    registerPostEndpoint(ctx, BALANCE_PATH, endpoint);
    const projections = ctx.get('sessionProjections');
    if (projections !== undefined)
        projections.register(billingProjectionDefinition(resolveBillingConfig(config)));
}
//# sourceMappingURL=index.js.map