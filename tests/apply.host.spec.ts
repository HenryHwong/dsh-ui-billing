/**
 * ui-billing node half on a real cordis Context with fake connection and
 * settings faces: apply registers the `/billing` balance channel on the
 * injected connection/webServer context, the handler answers `balance` with
 * the provider read and reports transport/provider failures as the error
 * branch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
import { BALANCE_CHANNEL, apply, inject } from '../src/index.ts'

let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response
}

async function bench(options: { settingsSection?: object; fetchResult?: Response } = {}) {
  const ctx = new Context()
  context = ctx
  let registered: { channel: string; handler: ConnectionRpcHandler } | undefined
  const handle = vi.fn((channel: string, handler: ConnectionRpcHandler) => {
    registered = { channel, handler }
    return async () => {}
  })
  ctx.provide('connection', { rpc: { handle } } as unknown as HostConnectionHandle)
  ctx.provide('webServer', {} as never)
  ctx.provide('settings', {
    get: () => options.settingsSection,
  } as unknown as SettingsProvider)
  ctx.provide('credentials', {
    resolve: async () => ({ value: 'sk-test' }),
  } as never)
  if (options.fetchResult !== undefined) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(options.fetchResult))
  } else {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      balance_infos: [{ currency: 'CNY', total_balance: '42' }],
    })))
  }

  const fiber = ctx.plugin({ inject, apply })
  await fiber.await()
  return { ctx, fiber, registered, handle }
}

describe('ui-billing node half', () => {
  it('registers the /billing channel', async () => {
    const { registered } = await bench()
    expect(registered?.channel).toBe(BALANCE_CHANNEL)
  })

  it('answers balance with the provider read for the default route', async () => {
    const { registered } = await bench({ settingsSection: {} })
    const result = await registered!.handler('balance', {}, new AbortController().signal)
    expect(result).toEqual({
      ok: true,
      value: { balance: { provider: 'deepseek-official', currency: 'CNY', totalBalance: 42 } },
    })
  })

  it('honors a requested provider in the payload', async () => {
    const { registered } = await bench()
    const result = await registered!.handler('balance', { provider: 'deepseek-official' }, new AbortController().signal)
    expect(result).toMatchObject({ ok: true })
  })

  it('reports an unknown endpoint as an error', async () => {
    const { registered } = await bench()
    const result = await registered!.handler('nope', {}, new AbortController().signal)
    expect(result).toMatchObject({
      ok: false,
      error: { message: 'ui-billing: unknown endpoint "nope"' },
    })
  })

  it('reports provider failures as the error branch', async () => {
    const { registered } = await bench({
      settingsSection: {},
      fetchResult: jsonResponse({ error: { message: 'bad key' } }, false, 401),
    })
    const result = await registered!.handler('balance', {}, new AbortController().signal)
    expect(result).toMatchObject({
      ok: false,
      error: { message: 'bad key' },
    })
  })

  it('stringifies a non-Error provider failure', async () => {
    const ctx = new Context()
    context = ctx
    let registered: { handler: ConnectionRpcHandler } | undefined
    ctx.provide('connection', {
      rpc: {
        handle: vi.fn((_channel: string, handler: ConnectionRpcHandler) => {
          registered = { handler }
          return async () => {}
        }),
      },
    } as unknown as HostConnectionHandle)
    ctx.provide('webServer', {} as never)
    ctx.provide('settings', { get: () => ({}) } as unknown as SettingsProvider)
    ctx.provide('credentials', {
      resolve: async () => { throw 'boom' },
    } as never)
    const fiber = ctx.plugin({ inject, apply })
    await fiber.await()
    const result = await registered!.handler('balance', {}, new AbortController().signal)
    expect(result).toMatchObject({
      ok: false,
      error: { message: 'boom' },
    })
  })
})
