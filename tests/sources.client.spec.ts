/**
 * The widget's two observable sources plus the balance transport seam: the cost
 * source follows the current-session projection face across selection changes,
 * and the balance source reads the node half's endpoint on first subscribe,
 * polls on an interval while subscribers remain, and reports failures as an
 * error snapshot. Pure observable semantics — no render machinery.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import { readProviderBalance } from '../src/client/seams/connection.ts'
import type { BalanceRead } from '../src/client/seams/connection.ts'
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

/** A stub reader answering every balance read with one fixed outcome. */
function readerOf(result: BalanceRead) {
  const read = vi.fn().mockResolvedValue(result)
  return { read, calls: read }
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
    const api = readerOf({ ok: true, balance: { currency: 'CNY', totalBalance: 110 } })
    const source = createBalanceSource(api.read)
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
    const api = readerOf({ ok: true, balance: { currency: 'CNY', totalBalance: 1 } })
    const source = createBalanceSource(api.read)
    const unsubscribe = source.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    unsubscribe()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(api.calls).toHaveBeenCalledTimes(1)
  })

  it('surfaces provider errors and keeps the last good value while reloading', async () => {
    let mode: 'ok' | 'error' = 'ok'
    const read = vi.fn(async (): Promise<BalanceRead> => (mode === 'ok'
      ? { ok: true, balance: { currency: 'CNY', totalBalance: 5 } }
      : { ok: false, error: 'no balance surface' }))
    const source = createBalanceSource(read)
    source.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    expect(source.getSnapshot()).toMatchObject({ status: 'ok' })

    mode = 'error'
    await vi.advanceTimersByTimeAsync(60_000)
    expect(source.getSnapshot()).toMatchObject({ status: 'error', error: 'no balance surface' })
  })

  it('collapses concurrent manual refreshes into one read', async () => {
    let resolveRead: ((result: BalanceRead) => void) | undefined
    const read = vi.fn(() => new Promise<BalanceRead>((resolve) => { resolveRead = resolve }))
    const source = createBalanceSource(read)
    const first = source.refresh()
    const second = source.refresh()
    expect(read).toHaveBeenCalledTimes(1)
    resolveRead?.({ ok: true, balance: { currency: 'CNY', totalBalance: 9 } })
    await first
    await second
    expect(source.getSnapshot()).toMatchObject({ status: 'ok', balance: { totalBalance: 9 } })
  })

  it('treats an ok result without a balance field as ok with no balance', async () => {
    const source = createBalanceSource(async () => ({ ok: true }))
    await source.refresh()
    expect(source.getSnapshot()).toEqual({ status: 'ok' })
  })

  it('surfaces a rejected read as an error snapshot', async () => {
    const source = createBalanceSource(vi.fn().mockRejectedValue(new Error('transport down')))
    await source.refresh()
    expect(source.getSnapshot()).toEqual({ status: 'error', error: 'transport down' })
  })

  it('stringifies a non-Error rejection', async () => {
    const source = createBalanceSource(vi.fn().mockRejectedValue('boom'))
    await source.refresh()
    expect(source.getSnapshot()).toEqual({ status: 'error', error: 'boom' })
  })

  it('keeps polling while any subscriber remains', async () => {
    const api = readerOf({ ok: true, balance: { currency: 'CNY', totalBalance: 3 } })
    const source = createBalanceSource(api.read)
    const first = source.subscribe(() => {})
    const second = source.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    first()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.calls).toHaveBeenCalledTimes(2)
    second()
  })

  it('tolerates a repeated unsubscribe of the last subscriber', async () => {
    const api = readerOf({ ok: true, balance: { currency: 'CNY', totalBalance: 3 } })
    const source = createBalanceSource(api.read)
    const unsubscribe = source.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    unsubscribe()
    unsubscribe()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(api.calls).toHaveBeenCalledTimes(1)
  })
})

describe('readProviderBalance', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('POSTs to the node half endpoint and returns the reported account', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ balance: { currency: 'CNY', totalBalance: 5 } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    await expect(readProviderBalance()).resolves.toEqual({
      ok: true,
      balance: { currency: 'CNY', totalBalance: 5 },
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/billing.balance', { method: 'POST' })
  })

  it('reads an ok response without a balance as the no-account outcome', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    await expect(readProviderBalance()).resolves.toEqual({ ok: true })
  })

  it('reports the endpoint error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: 'AUTH', message: 'bad key' } }),
      { status: 401 },
    )))
    await expect(readProviderBalance()).resolves.toEqual({ ok: false, error: 'bad key' })
  })

  it('falls back to the HTTP status when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 502 })))
    await expect(readProviderBalance()).resolves.toEqual({
      ok: false,
      error: 'ui-billing: balance read failed (HTTP 502)',
    })
  })

  it('folds a transport rejection into the failure branch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(readProviderBalance()).resolves.toEqual({ ok: false, error: 'network down' })
  })
})
