/**
 * ui-billing browser half on a real cordis Context with fake slots/sessions/
 * connection/locale faces: the plugin registers the billing widget entry at
 * sidebar.footer.action with the cost/balance hook sources and the refresh
 * verb, the sources follow the fake current-session projection, and
 * registration disposal rides the plugin fiber (HMR safety).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'

let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
})

async function bench(options: { cost?: object; balance?: object } = {}) {
  const ctx = new Context()
  context = ctx
  const balanceCall = vi.fn().mockResolvedValue(
    options.balance === undefined
      ? { ok: true as const, value: { balance: { provider: 'deepseek-official', currency: 'CNY', totalBalance: 110 } } }
      : options.balance,
  )
  const fakeHandle = { rpc: { call: balanceCall } } as unknown as ConnectionHandle

  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'sidebar.footer.action': { kind: 'list', scope: 'root' },
    },
  } as never, (() => null) as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const billingFace = {
    getSnapshot: () => options.cost,
    subscribe: () => () => {},
  }
  const currentSession = options.cost === undefined
    ? undefined
    : { projections: { faceOf: () => billingFace } }
  ctx.provide('sessions', {
    currentProvideInfo: {
      getSnapshot: () => ({ hooks: { session: currentSession } }),
      subscribe: () => () => {},
    },
  } as unknown as ISessions)
  ctx.provide('connection', fakeHandle)

  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return {
    ctx,
    fiber,
    balanceCall,
    entry: () => {
      const entry = ctx.slots.entries('sidebar.footer.action')[0]
      if (entry === undefined) return undefined
      return {
        ...entry.options,
        locale: entry.locale,
        inject: entry.inject as unknown as (() => {
          refreshBalance: () => void
          hooks: { billingCost: { getSnapshot(): unknown }; balance: { getSnapshot(): unknown } }
        }) | undefined,
      }
    },
  }
}

describe('ui-billing browser plugin', () => {
  it('registers the sidebar-footer billing entry with sources and the refresh verb', async () => {
    const b = await bench({ cost: { cost: 1.5, unpricedTokens: 0 } })
    expect(b.entry()).toMatchObject({ id: 'billing', order: 0, locale: 'billing' })
    const face = b.entry()!.inject!()
    expect(face.refreshBalance).toBeTypeOf('function')
    expect(face.hooks.billingCost.getSnapshot()).toEqual({ cost: 1.5, unpricedTokens: 0 })
    expect(face.hooks.balance.getSnapshot()).toEqual({ status: 'idle' })
    face.refreshBalance()
    await vi.waitFor(() => expect(b.balanceCall).toHaveBeenCalledTimes(1))
  })

  it('re-reads the balance after a connection reset', async () => {
    const b = await bench({})
    b.ctx.emit('connection/reset')
    await vi.waitFor(() => expect(b.balanceCall).toHaveBeenCalledTimes(1))
  })

  it('drops the entry when the plugin fiber unloads (HMR safety)', async () => {
    const b = await bench({ cost: { cost: 1, unpricedTokens: 0 } })
    expect(b.entry()).toBeDefined()
    await b.fiber.dispose()
    expect(b.entry()).toBeUndefined()
  })
})
