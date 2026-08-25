/**
 * Billing surface plugin, node half: serves the provider account balance to
 * the browser half over the `/billing` connection RPC channel. The browser
 * half ships via exports["./client"], discovered through the package.json
 * `dsh.client` declaration.
 *
 * @module @huanghanheng/dsh-ui-billing
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name. */
export declare const name = "ui-billing";
/** Required services: the connection RPC registry (balance channel) and settings (provider facts). */
export declare const inject: string[];
/** The balance channel this plugin owns; the browser half calls `balance` on it. */
export declare const BALANCE_CHANNEL = "/billing";
/**
 * Host plugin body: register the balance endpoint on the `/billing` channel.
 * @param ctx - registrant context carrying the connection and settings services.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map