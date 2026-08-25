/**
 * BillingFooter: the billing widget registered into the sidebar foot action
 * list. Wide mode renders two rows — the currently selected conversation's
 * cost and the provider account balance — with a refresh affordance on the
 * balance row; the collapsed rail renders a single ¥ glyph whose tooltip
 * carries both lines. All live facts arrive through the bound hooks; the
 * only local state is none — the refresh button just invokes the injected
 * callback.
 */
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { BillingCostSnapshot, BalanceSnapshot } from './sources.ts';
import type { BillingKey } from './locales.ts';
/** Compact CNY: `¥1.23`; amounts under a cent keep 4 significant decimals. */
export declare function formatCost(amount: number): string;
/** Fixed two-decimal balance: `¥110.00`. */
export declare function formatBalance(currency: string, amount: number): string;
/** The inject face: hooks (renderer-bound to `use<Name>` selectors) plus the refresh verb. */
export interface BillingFooterInjected {
    refreshBalance: () => void;
    hooks: {
        billingCost: HostObservable<BillingCostSnapshot>;
        balance: HostObservable<BalanceSnapshot>;
    };
}
/** Full composed props: owner share (sidebar column state) + locale seat + the injected face (hooks bound). */
export type BillingFooterProps = PropsRuntime<'sidebar.footer.action'> & PropsLocale<'billing'> & InjectFace<BillingFooterInjected>;
/** Render the balance row value: amount, loading ellipsis, or the unavailable note. */
export declare function balanceText(snapshot: BalanceSnapshot, t: (key: BillingKey) => string): string;
/**
 * The sidebar foot billing widget.
 * @param props - composed slot props.
 * @returns the widget tree (wide rows or the rail glyph).
 */
export declare function BillingFooter({ wide, useBillingCost, useBalance, refreshBalance, t }: BillingFooterProps): import("react").JSX.Element;
//# sourceMappingURL=BillingFooter.d.ts.map