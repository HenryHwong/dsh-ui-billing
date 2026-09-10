/**
 * Browser-side seam over the balance transport: the only module naming the
 * endpoint URL and its JSON shape, so a transport-side change stays a
 * single-file edit. The path literal is duplicated from the node half because a
 * client bundle cannot import it.
 *
 * @module @huanghanheng/dsh-ui-billing/client/seams/connection
 */
/** Provider account balance as the node half reports it. */
export interface ProviderBalance {
    currency: string;
    totalBalance: number;
    grantedBalance?: number;
    toppedUpBalance?: number;
}
/** One read's outcome: the account figures, or the failure message. */
export type BalanceRead = {
    readonly ok: true;
    readonly balance?: ProviderBalance;
} | {
    readonly ok: false;
    readonly error: string;
};
/**
 * Read the provider account balance.
 * @param signal - optional caller cancellation.
 * @returns the read outcome; transport and HTTP failures fold into the failure branch.
 */
export declare function readProviderBalance(signal?: AbortSignal): Promise<BalanceRead>;
//# sourceMappingURL=connection.d.ts.map