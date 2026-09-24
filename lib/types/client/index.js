import { BillingFooter } from "./BillingFooter.js";
import { en, zh } from "./locales.js";
import { readProviderBalance } from "./seams/connection.js";
import { currentSessionProjection } from "./seams/sessions.js";
import { createBalanceSource, createBillingCostSource } from "./sources.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'billing';
/** Required services: the slot ledger, the session area adapter (displayed session + projections), the connection (transport reset), and copy. */
export const inject = ['slots', 'uiSession', 'connection', 'locale'];
/**
 * Client plugin body: register the dictionaries and the sidebar-foot widget.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-billing: dictionaries');
    const costSource = createBillingCostSource(currentSessionProjection(ctx.uiSession));
    const balanceSource = createBalanceSource(readProviderBalance);
    // The account read is transport-owned: a reconnect invalidates a stale
    // balance, so re-read once the link is back (same lane as
    // ui-settings-general's metadata invalidations).
    ctx.effect(() => ctx.on('connection/reset', () => {
        void balanceSource.refresh();
    }), 'ui-billing: balance invalidation');
    // Release the projection-face subscription on unload (HMR safety).
    ctx.effect(() => () => {
        costSource.dispose();
    }, 'ui-billing: cost source disposal');
    ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'billing',
        order: 0,
        locale: NS,
        inject: () => ({
            refreshBalance: () => { void balanceSource.refresh(); },
            hooks: {
                billingCost: costSource,
                balance: balanceSource,
            },
        }),
    }, BillingFooter));
}
//# sourceMappingURL=index.js.map