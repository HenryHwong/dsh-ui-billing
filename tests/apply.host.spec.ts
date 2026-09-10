/**
 * ui-billing node half on a real cordis Context with fake connection and
 * settings faces: apply registers the `/api/billing.balance` endpoint on the
 * connection fetch registry, the endpoint answers with the provider read, and
 * transport/provider failures become non-2xx JSON errors.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { ConnectionFetchRoute, HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
import { BALANCE_PATH, apply, inject } from '../src/index.ts'

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

function balanceRequest(body?: string): Request {
  return new Request(`http://127.0.0.1${BALANCE_PATH}`, {
    method: 'POST',
    ...(body === undefined ? {} : { body }),
  })
}

async function bench(options: { settingsSection?: object; credentials?: object; fetchResult?: Response } = {}) {
  const ctx = new Context()
  context = ctx
  let registered: ConnectionFetchRoute | undefined
  const register = vi.fn((route: ConnectionFetchRoute) => {
    registered = route
    return () => {}
  })
  ctx.provide('connection', { fetch: { register } } as unknown as HostConnectionHandle)
  ctx.provide('settings', {
    get: () => options.settingsSection,
  } as unknown as SettingsProvider)
  ctx.provide('credentials', options.credentials ?? {
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
  return { ctx, fiber, registered, register }
}

describe('ui-billing node half', () => {
  it('registers the balance endpoint as an exact POST route', async () => {
    const { registered } = await bench()
    expect(registered?.path).toBe(BALANCE_PATH)
    expect(registered?.methods).toEqual(['POST'])
    expect(registered?.requestBody).toBe('buffered')
  })

  it('answers balance with the provider read for the default route', async () => {
    const { registered } = await bench({ settingsSection: {} })
    const response = await registered!.fetch(balanceRequest())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      balance: { provider: 'deepseek-official', currency: 'CNY', totalBalance: 42 },
    })
  })

  it('honors a requested provider in the body', async () => {
    const { registered } = await bench()
    const response = await registered!.fetch(balanceRequest(JSON.stringify({ provider: 'deepseek-official' })))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ balance: { provider: 'deepseek-official' } })
  })

  it('reads the default route when the body is absent or malformed', async () => {
    const { registered } = await bench({ settingsSection: {} })
    expect(await (await registered!.fetch(balanceRequest())).json())
      .toMatchObject({ balance: { provider: 'deepseek-official' } })
    expect(await (await registered!.fetch(balanceRequest('not json'))).json())
      .toMatchObject({ balance: { provider: 'deepseek-official' } })
  })

  it('reports provider failures as a non-2xx JSON error', async () => {
    const { registered } = await bench({
      settingsSection: {},
      fetchResult: jsonResponse({ error: { message: 'bad key' } }, false, 401),
    })
    const response = await registered!.fetch(balanceRequest())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'AUTH', message: 'bad key' } })
  })

  it('reports a missing credential as unauthorized', async () => {
    const { registered } = await bench({
      credentials: { resolve: async () => undefined } as never,
    })
    const response = await registered!.fetch(balanceRequest())
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: { code: 'MISSING_CREDENTIAL' } })
  })

  it('stringifies a non-Error provider failure', async () => {
    const { registered } = await bench({
      settingsSection: {},
      credentials: { resolve: async () => { throw 'boom' } } as never,
    })
    const response = await registered!.fetch(balanceRequest())
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: { code: 'internal', message: 'boom' } })
  })
})
