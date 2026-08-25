/**
 * Host-half balance read for the billing widget: resolves the DeepSeek
 * connection facts the same way `dsh-llm-deepseek` does (merged settings
 * section + launch environment + credential seam), calls the provider
 * balance endpoint, and normalizes failures to `LlmError`. The node half of
 * this package serves the result over the `/billing` connection channel.
 *
 * @module @huanghanheng/dsh-ui-billing/balance
 */

import type { Context } from '@deepseek-ai/cordis'
import { getOrCreateAnonymousUserId } from '@deepseek-ai/dsh-anonymous-user-id'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { assertUsableApiKey, attributionHeaders, isQuotaExceededError, LlmError, QUOTA_EXCEEDED_CODE } from '@deepseek-ai/dsh-llm'
import {
  resolveAdapterOptions,
  type Config as DeepSeekProviderConfig,
  type WireError,
} from '@deepseek-ai/dsh-llm-deepseek'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Wire payload of the DeepSeek balance endpoint. */
export interface WireBalance {
  is_available?: boolean
  balance_infos?: {
    currency?: string
    total_balance?: string
    granted_balance?: string
    topped_up_balance?: string
  }[]
}

/** Normalized provider account balance. */
export interface ProviderBalance {
  provider: string
  currency: string
  totalBalance: number
  grantedBalance?: number
  toppedUpBalance?: number
}

/** One balance read's HTTP facts. */
export interface BalanceRequest {
  provider: string
  baseURL: string
  apiKey: string
  userId: string
}

function noKeyError(provider: string, ref: CredentialRef): LlmError {
  return new LlmError(
    `ui-billing: no API key for provider route "${provider}"; store ${ref} through the credentials`
    + ` service (the web Models page writes it), or export ${ref} in the launching environment`,
    'MISSING_CREDENTIAL',
  )
}

/**
 * Resolve the balance endpoint facts for the DeepSeek provider route. The
 * merged `llm-deepseek` settings section is the single configuration source,
 * so a changed base URL or key reference reaches the very next read.
 * @param ctx - registrant context carrying the settings service.
 * @param provider - the provider route the balance belongs to.
 * @returns the request facts; rejects with `MISSING_CREDENTIAL` when no key resolves.
 */
export async function resolveBalanceRequest(ctx: Context, provider: string): Promise<BalanceRequest> {
  const raw = ctx.settings.get(settingsNamespace('llm-deepseek')) as DeepSeekProviderConfig | undefined
  const connection = resolveAdapterOptions(raw ?? {}, launchEnvironmentOf(ctx))
  const ref = connection.apiKeyEnv
  const credentials = ctx.get('credentials')
  let apiKey: string
  if (credentials !== undefined) {
    const hit = await credentials.resolve(ref)
    if (hit === undefined) throw noKeyError(provider, ref)
    apiKey = assertUsableApiKey(hit.value, 'ui-billing', ref)
  } else {
    const ambient = launchEnvironmentOf(ctx).get(ref)
    if (ambient === undefined || ambient.value.length === 0) throw noKeyError(provider, ref)
    apiKey = assertUsableApiKey(ambient.value, 'ui-billing', ref)
  }
  return {
    provider,
    baseURL: connection.baseURL,
    apiKey,
    userId: String(getOrCreateAnonymousUserId()),
  }
}

/** Map a non-2xx balance response status and body to a harness error code (the adapter's own mapping is not package-exported). */
function balanceHttpErrorCode(status: number, error?: WireError['error']): string {
  if (status === 401 || status === 403) return 'AUTH'
  if (status === 413) return 'INVALID_REQUEST'
  const detail = [error?.code, error?.type, error?.message].filter(Boolean).join(' ')
  if (isQuotaExceededError(detail)) return QUOTA_EXCEEDED_CODE
  if (status === 429) return 'RATE_LIMIT'
  if (status === 400) return 'INVALID_REQUEST'
  if (status >= 500) return 'SERVER'
  return `HTTP_${status}`
}

/** Map a non-2xx provider response to a normalized LlmError; a malformed error body never masks the status. */
async function balanceHttpError(response: Response): Promise<LlmError> {
  let message = `DeepSeek API error (HTTP ${response.status})`
  let providerError: WireError['error']
  try {
    const parsed = await response.json() as WireError
    providerError = parsed.error
    if (providerError?.message) message = providerError.message
  } catch {
    // Only swallow error-body parsing: the status still identifies the failure.
  }
  return new LlmError(message, balanceHttpErrorCode(response.status, providerError), { status: response.status })
}

/**
 * Read the provider account balance over HTTP.
 * @param request - resolved endpoint facts.
 * @param signal - optional caller cancellation; an aborted read rethrows the abort.
 * @returns the normalized balance.
 */
export async function fetchBalance(request: BalanceRequest, signal?: AbortSignal): Promise<ProviderBalance> {
  let response: Response
  try {
    response = await fetch(`${request.baseURL}/user/balance`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${request.apiKey}`,
        accept: 'application/json',
        ...attributionHeaders(),
        'x-deepseek-harness-user-id': request.userId,
      },
      ...(signal === undefined ? {} : { signal }),
    })
  } catch (error: unknown) {
    if (signal?.aborted) throw error
    throw new LlmError(
      `DeepSeek balance request to ${request.baseURL} failed`,
      'TRANSPORT',
      { cause: error },
    )
  }
  if (!response.ok) throw await balanceHttpError(response)
  let parsed: WireBalance
  try {
    parsed = await response.json() as WireBalance
  } catch {
    throw new LlmError('DeepSeek balance endpoint returned an unparseable body', 'EMPTY_RESPONSE')
  }
  const info = parsed.balance_infos?.[0]
  if (info === undefined || typeof info.currency !== 'string' || info.currency.length === 0) {
    throw new LlmError('DeepSeek balance endpoint returned no balance entry', 'EMPTY_RESPONSE')
  }
  const totalBalance = Number(info.total_balance)
  if (!Number.isFinite(totalBalance)) {
    throw new LlmError('DeepSeek balance endpoint returned a non-numeric total', 'EMPTY_RESPONSE')
  }
  const portion = (value: string | undefined): number | undefined => {
    const parsedValue = value === undefined ? undefined : Number(value)
    return parsedValue !== undefined && Number.isFinite(parsedValue) ? parsedValue : undefined
  }
  const grantedBalance = portion(info.granted_balance)
  const toppedUpBalance = portion(info.topped_up_balance)
  return {
    provider: request.provider,
    currency: info.currency,
    totalBalance,
    ...(grantedBalance === undefined ? {} : { grantedBalance }),
    ...(toppedUpBalance === undefined ? {} : { toppedUpBalance }),
  }
}
