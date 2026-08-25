/**
 * Reactive sources behind the billing footer widget. Business wiring only:
 * these are bare observable sources (uSES contract — stable getSnapshot
 * identity until the fact moves), constructed in `apply` and bound to
 * `useBillingCost` / `useBalance` hooks by the renderer. Polling and
 * re-subscription follow the observable lifecycle: the balance source starts
 * its refresh loop when the first subscriber arrives and stops when the last
 * one leaves.
 */

import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import type { ISessions, SessionFace } from '@deepseek-ai/dsh-client-runtime/client'
import type { BillingProjection } from '@deepseek-ai/dsh-billing/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'

/**
 * The balance channel the node half registers. A protocol constant the
 * browser half cannot import from the node half (client bundle purity), so
 * both halves keep the same literal.
 */
const BALANCE_CHANNEL = '/billing'

/** Cost of the currently selected session; undefined when none is selected or nothing is billed. */
export type BillingCostSnapshot = BillingProjection | undefined

/** Account balance read state; `balance` rides the latest successful read while newer reads load. */
export interface BalanceSnapshot {
  status: 'idle' | 'loading' | 'ok' | 'error'
  balance?: {
    currency: string
    totalBalance: number
    grantedBalance?: number
    toppedUpBalance?: number
  }
  /** Provider or transport error message from the last failed read. */
  error?: string
}

/** The billing-cost source: current-session projection follower. */
export interface BillingCostSource extends HostObservable<BillingCostSnapshot> {
  /** Release the selection and projection-face subscriptions (HMR disposal). */
  dispose(): void
}

/** The balance source: account read + polling lifecycle. */
export interface BalanceSource extends HostObservable<BalanceSnapshot> {
  /** Start one read now; safe to call concurrently (an in-flight read wins). */
  refresh(): Promise<void>
}

/** Balance polling interval while the widget is mounted. */
const BALANCE_REFRESH_MS = 60_000

/**
 * Follow the current session's `billing` projection. Selection changes rebind
 * the projection face; face changes re-read the snapshot. The runtime's
 * current-provide info is the single selection authority, so this source
 * subscribes to it and never to the list store.
 * @param sessions - the sessions service face.
 * @returns the cost source.
 */
export function createBillingCostSource(sessions: ISessions): BillingCostSource {
  let currentSession: SessionFace | undefined
  let face: { getSnapshot(): unknown; subscribe(fn: () => void): () => void } | undefined
  let unsubscribeFace: (() => void) | undefined
  let value: BillingProjection | undefined
  const listeners = new Set<() => void>()
  const notify = (): void => {
    for (const fn of [...listeners]) fn()
  }

  const sync = (): void => {
    const info = sessions.currentProvideInfo.getSnapshot()
    // The standard `session` hook face is the session binding itself
    // (SessionFace: the conversation observable plus the projections outlet);
    // absent without a selection (SessionMaybeProvideInfo keeps declared
    // names present with undefined values).
    const nextSession = info.hooks.session as SessionFace | undefined
    if (nextSession === currentSession) {
      if (face !== undefined) {
        const next = face.getSnapshot() as BillingProjection | undefined
        if (next !== value) {
          value = next
          notify()
        }
      }
      return
    }
    currentSession = nextSession
    unsubscribeFace?.()
    face = nextSession === undefined
      ? undefined
      : nextSession.projections.faceOf('billing')
    value = face === undefined ? undefined : face.getSnapshot() as BillingProjection | undefined
    unsubscribeFace = face?.subscribe(sync)
    notify()
  }
  const unsubscribeCurrent = sessions.currentProvideInfo.subscribe(sync)
  sync()
  return {
    getSnapshot: () => value,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    dispose: () => {
      unsubscribeCurrent()
      unsubscribeFace?.()
    },
  }
}

/**
 * Read the provider account balance through the `/billing` connection
 * channel. Subscribers start the refresh loop (immediate read + interval);
 * the last subscriber stops it.
 * @param rpc - the connection's generic channel caller.
 * @returns the balance source.
 */
export function createBalanceSource(rpc: ClientConnectionRpc): BalanceSource {
  let snapshot: BalanceSnapshot = { status: 'idle' }
  let inflight: Promise<void> | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  const listeners = new Set<() => void>()
  const notify = (): void => {
    for (const fn of [...listeners]) fn()
  }

  const refresh = async (): Promise<void> => {
    if (inflight !== undefined) return inflight
    snapshot = { ...snapshot, status: 'loading' }
    notify()
    inflight = (async () => {
      try {
        const response = await rpc.call(BALANCE_CHANNEL, 'balance', {})
        if (response.ok) {
          const value = response.value as { balance?: BalanceSnapshot['balance'] } | undefined
          snapshot = value?.balance === undefined
            ? { status: 'ok' }
            : { status: 'ok', balance: value.balance }
        } else {
          snapshot = { status: 'error', error: response.error.message }
        }
      } catch (error: unknown) {
        snapshot = { status: 'error', error: error instanceof Error ? error.message : String(error) }
      }
    })().finally(() => { inflight = undefined })
    await inflight
    notify()
  }

  const stop = (): void => {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }
  const start = (): void => {
    /* v8 ignore next -- defensive re-entry guard: subscribe gates start() to the first subscriber, so no second call sees a live timer. */
    if (timer !== undefined) return
    void refresh()
    timer = setInterval(() => { void refresh() }, BALANCE_REFRESH_MS)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (fn) => {
      listeners.add(fn)
      if (listeners.size === 1) start()
      return () => {
        listeners.delete(fn)
        if (listeners.size === 0) stop()
      }
    },
    refresh,
  }
}
