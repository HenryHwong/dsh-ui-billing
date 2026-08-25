import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type BillingKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The billing widget's copy. */
        billing: BillingKey;
    }
}
/** Required services: the slot ledger, sessions (selection + projections), the connection (balance channel), and copy. */
export declare const inject: string[];
/**
 * Client plugin body: register the dictionaries and the sidebar-foot widget.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map