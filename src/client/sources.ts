/**
 * Reactive sources behind the billing footer widget. Business wiring only:
 * these are bare observable sources (uSES contract — stable getSnapshot
 * identity until the fact moves), constructed in `apply` and bound to
 * `useBillingCost` / `useBalance` hooks by the renderer. Polling and
 * re-subscription follow the observable lifecycle: the balance source starts
 * its refresh loop when the first subscriber arrives and stops when the last
 * one leaves.
 */

import type { BillingProjection } from '@deepseek-ai/dsh-billing/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { BalanceRead, ProviderBalance } from './seams/connection.ts'
import type { CurrentSessionProjection } from './seams/sessions.ts'

/** Cost of the currently selected session; undefined when none is selected or nothing is billed. */
export type BillingCostSnapshot = BillingProjection | undefined

/** Account balance read state; `balance` rides the latest successful read while newer reads load. */
export interface BalanceSnapshot {
  status: 'idle' | 'loading' | 'ok' | 'error'
  balance?: ProviderBalance
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
 * Follow the displayed session's `billing` projection. Display changes rebind
 * the projection face; face movement re-reads the snapshot. The session area
 * adapter owns the displayed session, so this source follows the seam's
 * display feed instead of a list store of its own.
 * @param projection - the displayed-session projection seam.
 * @returns the cost source.
 */
export function createBillingCostSource(projection: CurrentSessionProjection): BillingCostSource {
  let face: HostObservable<unknown> | undefined
  let unsubscribeFace: (() => void) | undefined
  let value: BillingProjection | undefined
  const listeners = new Set<() => void>()
  const notify = (): void => {
    for (const fn of [...listeners]) fn()
  }

  const sync = (): void => {
    const next = projection.face('billing')
    if (next !== face) {
      unsubscribeFace?.()
      face = next
      unsubscribeFace = face?.subscribe(sync)
    }
    const nextValue = face?.getSnapshot() as BillingProjection | undefined
    if (nextValue !== value) {
      value = nextValue
      notify()
    }
  }
  const unsubscribeCurrent = projection.subscribe(sync)
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
export function createBalanceSource(read: () => Promise<BalanceRead>): BalanceSource {
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
        const result = await read()
        snapshot = result.ok
          ? result.balance === undefined ? { status: 'ok' } : { status: 'ok', balance: result.balance }
          : { status: 'error', error: result.error }
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
