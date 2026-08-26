//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@huanghanheng/dsh-ui-billing`.
* @module @huanghanheng/dsh-ui-billing/invariant
*/
const PACKAGE_NAME = "@huanghanheng/dsh-ui-billing";
/** Cordis companion plugin name. */
const name = "ui-billing-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: the projection unit is a pure fold whose wire payload
* is schema-validated by the projection registry at every snapshot and
* change-feed emission (its event relation — `assistant/message` carries the
* assembled source model and step usage — is owned by the agent loop and the
* session surface), and the balance channel is a single RPC registration
* whose disposal rides the plugin fiber.
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
