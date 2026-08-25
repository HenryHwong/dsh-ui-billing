/**
 * Billing surface plugin, node half: serves the provider account balance to
 * the browser half over the `/billing` connection RPC channel. The browser
 * half ships via exports["./client"], discovered through the package.json
 * `dsh.client` declaration.
 *
 * @module @huanghanheng/dsh-ui-billing
 */
import { fetchBalance, resolveBalanceRequest } from "./balance.js";
/** Cordis plugin name. */
export const name = 'ui-billing';
/** Required services: the connection RPC registry (balance channel) and settings (provider facts). */
export const inject = ['connection', 'settings'];
/** The balance channel this plugin owns; the browser half calls `balance` on it. */
export const BALANCE_CHANNEL = '/billing';
/**
 * Host plugin body: register the balance endpoint on the `/billing` channel.
 * @param ctx - registrant context carrying the connection and settings services.
 */
export function apply(ctx) {
    const handler = async (endpoint, payload, signal) => {
        if (endpoint !== 'balance') {
            return {
                ok: false,
                error: { code: 'internal', message: `ui-billing: unknown endpoint "${endpoint}"`, details: {} },
            };
        }
        const candidate = payload?.provider;
        const provider = typeof candidate === 'string' && candidate.length > 0 ? candidate : 'deepseek-official';
        try {
            const request = await resolveBalanceRequest(ctx, provider);
            const balance = await fetchBalance(request, signal);
            return { ok: true, value: { balance } };
        }
        catch (error) {
            return {
                ok: false,
                error: {
                    code: 'internal',
                    message: error instanceof Error ? error.message : String(error),
                    details: { provider },
                },
            };
        }
    };
    ctx.connection.rpc.handle(BALANCE_CHANNEL, handler, { authority: 'loopback' });
}
//# sourceMappingURL=index.js.map