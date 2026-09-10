/**
 * Host-side seam over the connection transport: the only module naming how this
 * plugin mounts its HTTP endpoint, so a transport-side change stays a
 * single-file edit.
 *
 * @module @huanghanheng/dsh-ui-billing/seams/connection
 */
import type { Context } from '@deepseek-ai/cordis';
/**
 * Mount one exact POST endpoint below the shared API channel.
 * @param ctx - registrant context carrying the connection service.
 * @param path - absolute path below `/api`.
 * @param fetch - endpoint implementation; its Response reaches the browser as-is.
 */
export declare function registerPostEndpoint(ctx: Context, path: string, fetch: (request: Request) => Promise<Response>): void;
//# sourceMappingURL=connection.d.ts.map