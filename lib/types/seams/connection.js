/**
 * Host-side seam over the Connection RPC registry: the only module naming the
 * registration contract of the harness Connection service, so a transport-side
 * change stays a single-file edit.
 *
 * @module @huanghanheng/dsh-ui-billing/seams/connection
 */
/**
 * Register one channel handler on the Connection RPC registry.
 * @param ctx - registrant context.
 * @param channel - absolute channel prefix.
 * @param handler - decoded endpoint handler.
 */
export function registerRpcChannel(ctx, channel, handler) {
    // The registry scopes a registration to the fiber reading the service and
    // mounts the channel's physical route through that fiber's webServer, so the
    // registration runs in an explicit injection materializing both services.
    ctx.inject(['connection', 'webServer'], (webCtx) => {
        webCtx.connection.rpc.handle(channel, handler);
    });
}
//# sourceMappingURL=connection.js.map