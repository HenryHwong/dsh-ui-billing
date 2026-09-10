/**
 * Billing surface plugin, browser half: one widget at the sidebar foot
 * showing the currently selected conversation's cost (from the `billing`
 * session projection) and the provider account balance (from the node half's
 * `billing.balance` endpoint). The widget owns no store and no event listener:
 * the cost source follows the current-session projection face, and the balance
 * source polls while mounted.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type BillingKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The billing widget's copy. */
        billing: BillingKey;
    }
}
/** Required services: the slot ledger, sessions (selection + projections), the connection (transport reset), and copy. */
export declare const inject: string[];
/**
 * Client plugin body: register the dictionaries and the sidebar-foot widget.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map