/**
 * Reactive sources behind the billing footer widget. Business wiring only:
 * these are bare observable sources (uSES contract — stable getSnapshot
 * identity until the fact moves), constructed in `apply` and bound to
 * `useBillingCost` / `useBalance` hooks by the renderer. Polling and
 * re-subscription follow the observable lifecycle: the balance source starts
 * its refresh loop when the first subscriber arrives and stops when the last
 * one leaves.
 */
import type { BillingProjection } from '@deepseek-ai/dsh-billing/client';
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
import type { BalanceRead, ProviderBalance } from './seams/connection.ts';
import type { CurrentSessionProjection } from './seams/sessions.ts';
/** Cost of the currently selected session; undefined when none is selected or nothing is billed. */
export type BillingCostSnapshot = BillingProjection | undefined;
/** Account balance read state; `balance` rides the latest successful read while newer reads load. */
export interface BalanceSnapshot {
    status: 'idle' | 'loading' | 'ok' | 'error';
    balance?: ProviderBalance;
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
 * the projection face; face movement re-reads the snapshot. The sessions
 * service owns selection, so this source follows the seam's selection feed
 * instead of a list store of its own.
 * @param projection - the current-session projection seam.
 * @returns the cost source.
 */
export declare function createBillingCostSource(projection: CurrentSessionProjection): BillingCostSource;
/**
 * Read the provider account balance through the `/billing` connection
 * channel. Subscribers start the refresh loop (immediate read + interval);
 * the last subscriber stops it.
 * @param rpc - the connection's generic channel caller.
 * @returns the balance source.
 */
export declare function createBalanceSource(read: () => Promise<BalanceRead>): BalanceSource;
//# sourceMappingURL=sources.d.ts.map