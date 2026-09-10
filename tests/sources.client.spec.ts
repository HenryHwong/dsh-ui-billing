/**
 * The widget's two observable sources: the cost source follows the
 * current-session projection face across selection changes, and the balance
 * source reads the `/billing` connection channel on first subscribe, polls
 * on an interval while subscribers remain, and reports failures as an error
 * snapshot. Pure observable semantics — no render machinery.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientConnectionRpc } from '../src/client/seams/connection.ts'
import type { CurrentSessionProjection } from '../src/client/seams/sessions.ts'
import { createBalanceSource, createBillingCostSource } from '../src/client/sources.ts'
import type { BalanceSnapshot } from '../src/client/sources.ts'

/** One stub projection face: an observable over a mutable value. */
function faceOf<T>(initial: T | undefined): HostObservable<T | undefined> & { set(next: T | undefined): void } {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    set: (next) => {
      if (next === value) return
      value = next
      for (const fn of [...listeners]) fn()
    },
  }
}

/** A stub current-session projection whose selected face can be switched. */
function projectionOf(initial: HostObservable<unknown> | undefined) {
  let face = initial
  const listeners = new Set<() => void>()
  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    face: () => face,
    select(next: HostObservable<unknown> | undefined): void {
      face = next
      for (const fn of [...listeners]) fn()
    },
  } as CurrentSessionProjection & { select(next: HostObservable<unknown> | undefined): void }
}

function rpcOf(balance: { ok: true; value: { balance: NonNullable<BalanceSnapshot['balance']> } } | { ok: false; error: { message: string } }) {
  const call = vi.fn().mockResolvedValue(balance)
  return { call, calls: call } as unknown as ClientConnectionRpc & { calls: ReturnType<typeof vi.fn> }
}

describe('createBillingCostSource', () => {
  it('follows the current session billing projection and selection changes', () => {
    const billingA = faceOf({ cost: 1.5, unpricedTokens: 0 })
    const billingB = faceOf({ cost: 2.5, unpricedTokens: 0 })
    const projection = projectionOf(billingA)
    const source = createBillingCostSource(projection)

    expect(source.getSnapshot()).toEqual({ cost: 1.5, unpricedTokens: 0 })
    billingA.set({ cost: 3.0, unpricedTokens: 0 })
    expect(source.getSnapshot()).toEqual({ cost: 3.0, unpricedTokens: 0 })

    projection.select(billingB)
    expect(source.getSnapshot()).toEqual({ cost: 2.5, unpricedTokens: 0 })

    projection.select(undefined)
    expect(source.getSnapshot()).toBeUndefined()

    source.dispose()
  })

  it('notifies subscribers on projection and selection movement', () => {
    const billing = faceOf<unknown>({ cost: 1, unpricedTokens: 0 })
    const projection = projectionOf(billing)
    const source = createBillingCostSource(projection)
    const onNext = vi.fn()
    source.subscribe(onNext)

    billing.set({ cost: 2, unpricedTokens: 0 })
    expect(onNext).toHaveBeenCalledTimes(1)
    source.subscribe(() => {}) // second subscriber is not re-notified by the same movement
    billing.set({ cost: 3, unpricedTokens: 0 })
    expect(onNext).toHaveBeenCalledTimes(2)
  })

  it('stops notifying after its subscriber unsubscribes', () => {
    const billing = faceOf<unknown>({ cost: 1, unpricedTokens: 0 })
    const projection = projectionOf(billing)
    const source = createBillingCostSource(projection)
    const onNext = vi.fn()
    const unsubscribe = source.subscribe(onNext)
    billing.set({ cost: 2, unpricedTokens: 0 })
    expect(onNext).toHaveBeenCalledTimes(1)
    unsubscribe()
    billing.set({ cost: 3, unpricedTokens: 0 })
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('keeps the value silent when the same session is re-selected', () => {
    const billing = faceOf({ cost: 1.5, unpricedTokens: 0 })
    const projection = projectionOf(billing)
    const source = createBillingCostSource(projection)
    const onNext = vi.fn()
    source.subscribe(onNext)
    expect(source.getSnapshot()).toEqual({ cost: 1.5, unpricedTokens: 0 })
    // Re-selecting the same session re-reads the face but must not re-emit
    // (Object.is gate on the unchanged snapshot).
    projection.select(billing)
    expect(onNext).toHaveBeenCalledTimes(0)
    source.dispose()
  })

  it('disposes the projection-face subscription while it is live', () => {
    const billing = faceOf({ cost: 1, unpricedTokens: 0 })
    const projection = projectionOf(billing)
    const source = createBillingCostSource(projection)
    source.subscribe(() => {})
    source.dispose()
    // The face is unsubscribed: a later movement no longer notifies anyone.
    billing.set({ cost: 9, unpricedTokens: 0 })
    expect(source.getSnapshot()).toEqual({ cost: 1, unpricedTokens: 0 })
  })
})

describe('createBalanceSource', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('reads immediately on first subscribe and polls while mounted', async () => {
    const api = rpcOf({ ok: true, value: { balance: { currency: 'CNY', totalBalance: 110 } } })
    const source = createBalanceSource(api)
    const values: BalanceSnapshot[] = []
    source.subscribe((() => { values.push(source.getSnapshot()) }))
    await vi.advanceTimersByTimeAsync(0)
    expect(source.getSnapshot()).toMatchObject({ status: 'ok', balance: { totalBalance: 110 } })
    expect(api.calls).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.calls).toHaveBeenCalledTimes(2)
    expect(values.at(-1)).toMatchObject({ status: 'ok' })
  })

  it('stops polling when the last subscriber leaves', async () => {
    const api = rpcOf({ ok: true, value: { balance: { currency: 'CNY', totalBalance: 1 } } })
    const source = createBalanceSource(api)
    const unsubscribe = source.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    unsubscribe()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(api.calls).toHaveBeenCalledTimes(1)
  })

  it('surfaces provider errors and keeps the last good value while reloading', async () => {
    let mode: 'ok' | 'error' = 'ok'
    const api = {
      call: vi.fn().mockImplementation(() => Promise.resolve(
        mode === 'ok'
          ? { ok: true as const, value: { balance: { currency: 'CNY', totalBalance: 5 } } }
          : { ok: false as const, error: { message: 'no balance surface', code: 'balance-unavailable', details: { provider: 'p' } } },
      )),
    } as unknown as ClientConnectionRpc
    const source = createBalanceSource(api)
    source.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    expect(source.getSnapshot()).toMatchObject({ status: 'ok' })

    mode = 'error'
    await vi.advanceTimersByTimeAsync(60_000)
    expect(source.getSnapshot()).toMatchObject({ status: 'error', error: 'no balance surface' })
  })

  it('collapses concurrent manual refreshes into one read', async () => {
    let resolveRead: (() => void) | undefined
    const balanceMock = vi.fn(() => new Promise((resolve) => {
      resolveRead = () => { resolve({ ok: true as const, value: { balance: { currency: 'CNY', totalBalance: 9 } } }) }
    }))
    const api = { call: balanceMock } as unknown as ClientConnectionRpc
    const source = createBalanceSource(api)
    const first = source.refresh()
    const second = source.refresh()
    expect(balanceMock).toHaveBeenCalledTimes(1)
    resolveRead?.()
    await first
    await second
    expect(source.getSnapshot()).toMatchObject({ status: 'ok', balance: { totalBalance: 9 } })
  })

  it('treats an ok result without a balance field as ok with no balance', async () => {
    const api = { call: vi.fn().mockResolvedValue({ ok: true as const, value: {} }) } as unknown as ClientConnectionRpc
    const source = createBalanceSource(api)
    await source.refresh()
    expect(source.getSnapshot()).toEqual({ status: 'ok' })
  })

  it('surfaces a rejected read as an error snapshot', async () => {
    const api = { call: vi.fn().mockRejectedValue(new Error('transport down')) } as unknown as ClientConnectionRpc
    const source = createBalanceSource(api)
    await source.refresh()
    expect(source.getSnapshot()).toEqual({ status: 'error', error: 'transport down' })
  })

  it('stringifies a non-Error rejection', async () => {
    const api = { call: vi.fn().mockRejectedValue('boom') } as unknown as ClientConnectionRpc
    const source = createBalanceSource(api)
    await source.refresh()
    expect(source.getSnapshot()).toEqual({ status: 'error', error: 'boom' })
  })

  it('keeps polling while any subscriber remains', async () => {
    const api = rpcOf({ ok: true, value: { balance: { currency: 'CNY', totalBalance: 3 } } })
    const source = createBalanceSource(api)
    const first = source.subscribe(() => {})
    const second = source.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    first()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.calls).toHaveBeenCalledTimes(2)
    second()
  })

  it('tolerates a repeated unsubscribe of the last subscriber', async () => {
    const api = rpcOf({ ok: true, value: { balance: { currency: 'CNY', totalBalance: 3 } } })
    const source = createBalanceSource(api)
    const unsubscribe = source.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    unsubscribe()
    unsubscribe()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(api.calls).toHaveBeenCalledTimes(1)
  })
})
