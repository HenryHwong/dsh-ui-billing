/**
 * Billing surface plugin, node half: serves the provider account balance to
 * the browser half over the `/billing` connection RPC channel. The browser
 * half ships via exports["./client"], discovered through the package.json
 * `dsh.client` declaration.
 *
 * @module @huanghanheng/dsh-ui-billing
 */

import type { Context } from '@deepseek-ai/cordis'
import type { RpcResult } from '@deepseek-ai/dsh-host-apiproxy/api'
// Type-only: pulls the connection package's host Context merge (ctx.connection).
import type {} from '@deepseek-ai/dsh-client-connection'
import { fetchBalance, resolveBalanceRequest } from './balance.ts'

/** Cordis plugin name. */
export const name = 'ui-billing'
/** Required services: the connection RPC registry (balance channel) and settings (provider facts). */
export const inject = ['connection', 'settings']

/** The balance channel this plugin owns; the browser half calls `balance` on it. */
export const BALANCE_CHANNEL = '/billing'

/**
 * Host plugin body: register the balance endpoint on the `/billing` channel.
 * @param ctx - registrant context carrying the connection and settings services.
 */
export function apply(ctx: Context): void {
  const handler = async (endpoint: string, payload: unknown, signal: AbortSignal): Promise<RpcResult<unknown>> => {
    if (endpoint !== 'balance') {
      return {
        ok: false,
        error: { code: 'internal', message: `ui-billing: unknown endpoint "${endpoint}"`, details: {} },
      }
    }
    const candidate = (payload as { provider?: unknown } | undefined)?.provider
    const provider = typeof candidate === 'string' && candidate.length > 0 ? candidate : 'deepseek-official'
    try {
      const request = await resolveBalanceRequest(ctx, provider)
      const balance = await fetchBalance(request, signal)
      return { ok: true, value: { balance } }
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          code: 'internal',
          message: error instanceof Error ? error.message : String(error),
          details: { provider },
        },
      }
    }
  }
  ctx.connection.rpc.handle(BALANCE_CHANNEL, handler, { authority: 'loopback' })
}
