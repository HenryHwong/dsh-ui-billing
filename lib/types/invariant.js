/**
 * Package-owned invariant companion for `@huanghanheng/dsh-ui-billing`.
 * @module @huanghanheng/dsh-ui-billing/invariant
 */
const PACKAGE_NAME = '@huanghanheng/dsh-ui-billing';
/** Cordis companion plugin name. */
export const name = 'ui-billing-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: a single sidebar-footer registration whose disposal
 * is proven by the HMR-safety spec — the plugin owns no store (cost arrives
 * on the billing session projection, balance on the RPC read), emits no
 * cordis events beyond the connection/reset refresh lane, and holds no
 * cross-plugin mutable state beyond the two widget-local sources.
 */
const install = () => { };
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
/* jscpd:ignore-end */
//# sourceMappingURL=invariant.js.map