/**
 * Host-side seam over the Connection RPC registry: the only module naming the
 * registration contract of the harness Connection service, so a transport-side
 * change stays a single-file edit.
 *
 * @module @huanghanheng/dsh-ui-billing/seams/connection
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionRpcHandler, ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection';
export type { ConnectionRpcHandler, ConnectionRpcResult };
/**
 * Register one channel handler on the Connection RPC registry.
 * @param ctx - registrant context.
 * @param channel - absolute channel prefix.
 * @param handler - decoded endpoint handler.
 */
export declare function registerRpcChannel(ctx: Context, channel: string, handler: ConnectionRpcHandler): void;
//# sourceMappingURL=connection.d.ts.map