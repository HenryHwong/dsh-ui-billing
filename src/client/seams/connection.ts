/**
 * Browser-side seam over the balance transport: the only module naming the
 * endpoint URL and its JSON shape, so a transport-side change stays a
 * single-file edit. The path literal is duplicated from the node half because a
 * client bundle cannot import it.
 *
 * @module @huanghanheng/dsh-ui-billing/client/seams/connection
 */

/** Provider account balance as the node half reports it. */
export interface ProviderBalance {
  currency: string
  totalBalance: number
  grantedBalance?: number
  toppedUpBalance?: number
}

/** One read's outcome: the account figures, or the failure message. */
export type BalanceRead =
  | { readonly ok: true; readonly balance?: ProviderBalance }
  | { readonly ok: false; readonly error: string }

/** The node half's balance endpoint. */
const BALANCE_PATH = '/api/billing.balance'

/**
 * Read the provider account balance.
 * @param signal - optional caller cancellation.
 * @returns the read outcome; transport and HTTP failures fold into the failure branch.
 */
export async function readProviderBalance(signal?: AbortSignal): Promise<BalanceRead> {
  try {
    const response = await fetch(BALANCE_PATH, {
      method: 'POST',
      ...(signal === undefined ? {} : { signal }),
    })
    const body = await response.json().catch(() => undefined) as {
      balance?: ProviderBalance
      error?: { message?: unknown }
    } | undefined
    if (!response.ok || body?.error !== undefined) {
      return {
        ok: false,
        error: typeof body?.error?.message === 'string'
          ? body.error.message
          : `ui-billing: balance read failed (HTTP ${response.status})`,
      }
    }
    return { ok: true, ...(body?.balance === undefined ? {} : { balance: body.balance }) }
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
