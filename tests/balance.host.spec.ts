/**
 * Host-half balance read: `fetchBalance` normalizes the provider endpoint
 * (success, HTTP errors, malformed bodies, transport failures, aborts), and
 * `resolveBalanceRequest` gathers the endpoint facts from the provider entry's
 * live configuration, the credential seam, and the launch environment.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SettingsForms from '@deepseek-ai/dsh-settings'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { LlmError, QUOTA_EXCEEDED_CODE } from '@deepseek-ai/dsh-llm'
import { fetchBalance, resolveBalanceRequest } from '../src/balance.ts'
import type { BalanceRequest } from '../src/balance.ts'

const request: BalanceRequest = {
  provider: 'deepseek-official',
  baseURL: 'https://api.deepseek.com',
  apiKey: 'sk-test',
  userId: 'u-1',
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('fetchBalance', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('reads and normalizes a full balance payload', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      is_available: true,
      balance_infos: [{
        currency: 'CNY',
        total_balance: '110.5',
        granted_balance: '10.5',
        topped_up_balance: '100',
      }],
    }))
    const balance = await fetchBalance(request)
    expect(balance).toEqual({
      provider: 'deepseek-official',
      currency: 'CNY',
      totalBalance: 110.5,
      grantedBalance: 10.5,
      toppedUpBalance: 100,
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.deepseek.com/user/balance')
    expect(init.method).toBe('GET')
    expect(init.headers).toMatchObject({
      authorization: 'Bearer sk-test',
      'x-deepseek-harness-user-id': 'u-1',
      accept: 'application/json',
    })
  })

  it('omits absent granted and topped-up portions', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      balance_infos: [{ currency: 'CNY', total_balance: '7' }],
    }))
    const balance = await fetchBalance(request)
    expect(balance).toEqual({ provider: 'deepseek-official', currency: 'CNY', totalBalance: 7 })
  })

  it('maps an authenticated HTTP error with a provider message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(
      { error: { message: 'bad key', code: 'invalid_api_key' } },
      false,
      401,
    ))
    const error = await fetchBalance(request).catch((e: unknown) => e) as LlmError
    expect(error).toBeInstanceOf(LlmError)
    expect(error.code).toBe('AUTH')
    expect(error.message).toBe('bad key')
    expect(error.failure.status).toBe(401)
  })

  it('maps a quota HTTP error to QUOTA_EXCEEDED', async () => {
    fetchMock.mockResolvedValue(jsonResponse(
      { error: { code: 'insufficient_quota' } },
      false,
      402,
    ))
    const error = await fetchBalance(request).catch((e: unknown) => e) as LlmError
    expect(error.code).toBe(QUOTA_EXCEEDED_CODE)
  })

  it('maps the remaining status families', async () => {
    const cases: Array<[number, string]> = [
      [413, 'INVALID_REQUEST'],
      [429, 'RATE_LIMIT'],
      [400, 'INVALID_REQUEST'],
      [418, 'HTTP_418'],
    ]
    for (const [status, code] of cases) {
      fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'nope' } }, false, status))
      const error = await fetchBalance(request).catch((e: unknown) => e) as LlmError
      expect(error.code).toBe(code)
    }
  })

  it('keeps the status message when the error body is unparseable', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new SyntaxError('bad json') },
    } as unknown as Response)
    const error = await fetchBalance(request).catch((e: unknown) => e) as LlmError
    expect(error.code).toBe('SERVER')
    expect(error.message).toBe('DeepSeek API error (HTTP 500)')
  })

  it('rejects an unparseable success body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('bad json') },
    } as unknown as Response)
    const emptyError = await fetchBalance(request).catch((e: unknown) => e) as LlmError
    expect(emptyError.code).toBe('EMPTY_RESPONSE')
  })

  it('rejects a payload without a balance entry', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ is_available: false }))
    const error = await fetchBalance(request).catch((e: unknown) => e) as LlmError
    expect(error.code).toBe('EMPTY_RESPONSE')
    expect(error.message).toBe('DeepSeek balance endpoint returned no balance entry')
  })

  it('rejects a non-numeric total', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      balance_infos: [{ currency: 'CNY', total_balance: 'abc' }],
    }))
    const error = await fetchBalance(request).catch((e: unknown) => e) as LlmError
    expect(error.code).toBe('EMPTY_RESPONSE')
    expect(error.message).toBe('DeepSeek balance endpoint returned a non-numeric total')
  })

  it('wraps a transport failure and rethrows aborts', async () => {
    const transport = new TypeError('network down')
    fetchMock.mockRejectedValue(transport)
    const error = await fetchBalance(request).catch((e: unknown) => e) as LlmError
    expect(error.code).toBe('TRANSPORT')
    expect(error.cause).toBe(transport)

    const abortError = new DOMException('aborted', 'AbortError')
    fetchMock.mockRejectedValue(abortError)
    const controller = new AbortController()
    controller.abort()
    await expect(fetchBalance(request, controller.signal)).rejects.toBe(abortError)
  })
})

describe('resolveBalanceRequest', () => {
  function contextWith(options: {
    settingsSection?: object
    credentialValue?: string
    ambientKey?: string
  }): Context {
    const ctx = new Context()
    ctx.provide('settings', {
      describe: () => (options.settingsSection === undefined
        ? []
        : [{ ns: 'llm-deepseek', value: options.settingsSection }]),
    } as unknown as SettingsForms)
    if (options.credentialValue !== undefined) {
      ctx.provide('credentials', {
        resolve: async () => ({ value: options.credentialValue }),
      } as never)
    }
    if (options.ambientKey !== undefined) {
      ctx.provide('launchEnvironment', createLaunchEnvironmentSnapshot([
        { source: 'process', values: { DEEPSEEK_API_KEY: options.ambientKey } },
      ]))
    }
    return ctx
  }

  it('resolves the endpoint from the provider entry config and the credential seam', async () => {
    const ctx = contextWith({
      settingsSection: { baseURL: 'https://gateway.example' },
      credentialValue: 'sk-cred',
    })
    const resolved = await resolveBalanceRequest(ctx, 'deepseek-official')
    expect(resolved).toMatchObject({
      provider: 'deepseek-official',
      baseURL: 'https://gateway.example',
      apiKey: 'sk-cred',
    })
    expect(resolved.userId.length).toBeGreaterThan(0)
  })

  it('falls back to the launch environment when the credential seam is absent', async () => {
    const ctx = contextWith({ ambientKey: 'sk-ambient' })
    const resolved = await resolveBalanceRequest(ctx, 'deepseek-official')
    expect(resolved.apiKey).toBe('sk-ambient')
    expect(resolved.baseURL).toBe('https://api.deepseek.com')
  })

  it('reads the account root below the Messages mount', async () => {
    const ctx = contextWith({
      settingsSection: { baseURL: 'https://gateway.example/anthropic' },
      credentialValue: 'sk-cred',
    })
    const resolved = await resolveBalanceRequest(ctx, 'deepseek-official')
    expect(resolved.baseURL).toBe('https://gateway.example')
  })

  it('rejects MISSING_CREDENTIAL when no key resolves', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '')
    const ctx = contextWith({})
    await expect(resolveBalanceRequest(ctx, 'deepseek-official')).rejects.toMatchObject({
      code: 'MISSING_CREDENTIAL',
    })
    vi.unstubAllEnvs()
  })

  it('rejects MISSING_CREDENTIAL when the credential seam resolves nothing', async () => {
    const ctx = new Context()
    ctx.provide('settings', { describe: () => [] } as unknown as SettingsForms)
    ctx.provide('credentials', { resolve: async () => undefined } as never)
    await expect(resolveBalanceRequest(ctx, 'deepseek-official')).rejects.toMatchObject({
      code: 'MISSING_CREDENTIAL',
    })
  })
})
