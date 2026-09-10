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
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { TieredModelPrice } from './projection.ts';
/** Cordis plugin name. */
export declare const name = "ui-billing";
/** Required services: connection (endpoint transport) and settings (provider facts); session projections are probed dynamically. */
export declare const inject: string[];
/** The balance endpoint this plugin owns; the browser half fetches the same literal. */
export declare const BALANCE_PATH = "/api/billing.balance";
/** Billing configuration as validated and defaulted by the Loader. */
export interface Config {
    /** CNY-per-million-token prices by model id; missing models count as unpriced. */
    prices: Record<string, TieredModelPrice>;
    /** Peak-hour windows, each `[start, end]` in minutes since midnight of the price clock. */
    peakHours: [number, number][];
    /** Fixed UTC offset of the price clock in minutes. */
    utcOffsetMinutes: number;
}
/** Loader schema; a missing field falls back to the shipped defaults. The
 * price table passes through `z.any()` because its nested shape is the
 * deployment's own (the fold reads it defensively). The default peak windows
 * are the official Beijing workday schedule (09:00-12:00, 14:00-18:00); the
 * window model cannot exclude weekends, so deployments may clear `peakHours`
 * to price everything off-peak. */
export declare const Config: z<Config>;
/**
 * Host plugin body: register the balance endpoint and, when the composition
 * mounts the projection registry, the `billing` cost unit (its registration is
 * an effect on this fiber, so unloading removes the key).
 * @param ctx - registrant context carrying the connection and settings services.
 * @param config - the deployment's price table and peak windows.
 */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map