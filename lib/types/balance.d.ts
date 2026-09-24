/**
 * Host-half balance read for the billing widget: resolves the DeepSeek
 * connection facts the same way `dsh-llm-deepseek` does (merged settings
 * section + launch environment + credential seam), calls the provider
 * balance endpoint, and normalizes failures to `LlmError`. The node half of
 * this package serves the result over the `/billing` connection channel.
 *
 * @module @huanghanheng/dsh-ui-billing/balance
 */
import type { Context } from '@deepseek-ai/cordis';
/** Wire payload of the DeepSeek balance endpoint. */
export interface WireBalance {
    is_available?: boolean;
    balance_infos?: {
        currency?: string;
        total_balance?: string;
        granted_balance?: string;
        topped_up_balance?: string;
    }[];
}
/** Normalized provider account balance. */
export interface ProviderBalance {
    provider: string;
    currency: string;
    totalBalance: number;
    grantedBalance?: number;
    toppedUpBalance?: number;
}
/** One balance read's HTTP facts. */
export interface BalanceRequest {
    provider: string;
    baseURL: string;
    apiKey: string;
    userId: string;
}
/**
 * Resolve the balance endpoint facts for the DeepSeek provider route. The
 * `llm-deepseek` entry's live configuration is the single source, so a changed
 * base URL or key reference reaches the very next read.
 * @param ctx - registrant context carrying the settings service.
 * @param provider - the provider route the balance belongs to.
 * @returns the request facts; rejects with `MISSING_CREDENTIAL` when no key resolves.
 */
export declare function resolveBalanceRequest(ctx: Context, provider: string): Promise<BalanceRequest>;
/**
 * Read the provider account balance over HTTP.
 * @param request - resolved endpoint facts.
 * @param signal - optional caller cancellation; an aborted read rethrows the abort.
 * @returns the normalized balance.
 */
export declare function fetchBalance(request: BalanceRequest, signal?: AbortSignal): Promise<ProviderBalance>;
//# sourceMappingURL=balance.d.ts.map