import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * BillingFooter: the billing widget registered into the sidebar foot action
 * list. Wide mode renders two rows — the currently selected conversation's
 * cost and the provider account balance — with a refresh affordance on the
 * balance row; the collapsed rail renders a single ¥ glyph whose tooltip
 * carries both lines. All live facts arrive through the bound hooks; the
 * only local state is none — the refresh button just invokes the injected
 * callback.
 */
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './BillingFooter.module.css';
/** Compact CNY: `¥1.23`; amounts under a cent keep 4 significant decimals. */
export function formatCost(amount) {
    if (amount === 0)
        return '¥0';
    if (amount >= 1)
        return `¥${amount.toFixed(2)}`;
    return `¥${amount.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
}
/** Fixed two-decimal balance: `¥110.00`. */
export function formatBalance(currency, amount) {
    const sign = currency === 'CNY' ? '¥' : `${currency} `;
    return `${sign}${amount.toFixed(2)}`;
}
/** Render the balance row value: amount, loading ellipsis, or the unavailable note. */
export function balanceText(snapshot, t) {
    if (snapshot.status === 'error')
        return t('balance.unavailable');
    if (snapshot.status !== 'ok' || snapshot.balance === undefined)
        return t('balance.loading');
    return formatBalance(snapshot.balance.currency, snapshot.balance.totalBalance);
}
/**
 * The sidebar foot billing widget.
 * @param props - composed slot props.
 * @returns the widget tree (wide rows or the rail glyph).
 */
export function BillingFooter({ wide, useBillingCost, useBalance, refreshBalance, t }) {
    const cost = useBillingCost(s => s);
    const balance = useBalance(s => s);
    const costValue = cost === undefined ? '—' : formatCost(cost.cost);
    const costTitle = cost !== undefined && cost.unpricedTokens > 0
        ? `${costValue} (+${cost.unpricedTokens} tokens unpriced)`
        : undefined;
    const balanceValue = balanceText(balance, t);
    if (!wide) {
        const tip = `${t('cost.label')} ${costValue} · ${t('balance.label')} ${balanceValue}`;
        return (_jsx(Tooltip, { label: tip, side: "top", delayMs: 500, children: _jsx("button", { type: "button", className: css.railButton, "aria-label": tip, onClick: () => { refreshBalance(); }, "data-billing-rail": true, children: _jsx("span", { "aria-hidden": true, children: "\u00A5" }) }) }));
    }
    return (_jsxs("div", { className: css.root, "data-billing-footer": true, children: [_jsxs("div", { className: css.row, title: costTitle, children: [_jsx("span", { className: css.label, children: t('cost.label') }), _jsx("span", { className: css.value, "data-billing-cost": true, children: costValue })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { className: css.label, children: t('balance.label') }), _jsx("span", { className: css.value, "data-billing-balance": true, children: balanceValue }), _jsx(Tooltip, { label: t('balance.refresh'), side: "top", delayMs: 500, children: _jsx("button", { type: "button", className: css.refresh, "aria-label": t('balance.refresh'), onClick: () => { refreshBalance(); }, "data-billing-refresh": true, children: _jsx(IconRefreshOutline16, { size: 12 }) }) })] })] }));
}
//# sourceMappingURL=BillingFooter.js.map