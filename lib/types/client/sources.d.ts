/**
 * Reactive sources behind the billing footer widget. Business wiring only:
 * these are bare observable sources (uSES contract — stable getSnapshot
 * identity until the fact moves), constructed in `apply` and bound to
 * `useBillingCost` / `useBalance` hooks by the renderer. Polling and
 * re-subscription follow the observable lifecycle: the balance source starts
 * its refresh loop when the first subscriber arrives and stops when the last
 * one leaves.
 */
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client';
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client';
import type { BillingProjection } from '@deepseek-ai/dsh-billing/client';
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
/** Cost of the currently selected session; undefined when none is selected or nothing is billed. */
export type BillingCostSnapshot = BillingProjection | undefined;
/** Account balance read state; `balance` rides the latest successful read while newer reads load. */
export interface BalanceSnapshot {
    status: 'idle' | 'loading' | 'ok' | 'error';
    balance?: {
        currency: string;
        totalBalance: number;
        grantedBalance?: number;
        toppedUpBalance?: number;
    };
    /** Provider or transport error message from the last failed read. */
    error?: string;
}
/** The billing-cost source: current-session projection follower. */
export interface BillingCostSource extends HostObservable<BillingCostSnapshot> {
    /** Release the selection and projection-face subscriptions (HMR disposal). */
    dispose(): void;
}
/** The balance source: account read + polling lifecycle. */
export interface BalanceSource extends HostObservable<BalanceSnapshot> {
    /** Start one read now; safe to call concurrently (an in-flight read wins). */
    refresh(): Promise<void>;
}
/**
 * Follow the current session's `billing` projection. Selection changes rebind
 * the projection face; face changes re-read the snapshot. The runtime's
 * current-provide info is the single selection authority, so this source
 * subscribes to it and never to the list store.
 * @param sessions - the sessions service face.
 * @returns the cost source.
 */
export declare function createBillingCostSource(sessions: ISessions): BillingCostSource;
/**
 * Read the provider account balance through the `/billing` connection
 * channel. Subscribers start the refresh loop (immediate read + interval);
 * the last subscriber stops it.
 * @param rpc - the connection's generic channel caller.
 * @returns the balance source.
 */
export declare function createBalanceSource(rpc: ClientConnectionRpc): BalanceSource;
//# sourceMappingURL=sources.d.ts.map