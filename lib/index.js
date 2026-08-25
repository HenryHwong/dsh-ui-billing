import { getOrCreateAnonymousUserId } from "@deepseek-ai/dsh-anonymous-user-id";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { LlmError, QUOTA_EXCEEDED_CODE, assertUsableApiKey, attributionHeaders, isQuotaExceededError } from "@deepseek-ai/dsh-llm";
import { resolveAdapterOptions } from "@deepseek-ai/dsh-llm-deepseek";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
//#region lib/types/balance.js
/**
* Host-half balance read for the billing widget: resolves the DeepSeek
* connection facts the same way `dsh-llm-deepseek` does (merged settings
* section + launch environment + credential seam), calls the provider
* balance endpoint, and normalizes failures to `LlmError`. The node half of
* this package serves the result over the `/billing` connection channel.
*
* @module @huanghanheng/dsh-ui-billing/balance
*/
function noKeyError(provider, ref) {
	return new LlmError(`ui-billing: no API key for provider route "${provider}"; store ${ref} through the credentials service (the web Models page writes it), or export ${ref} in the launching environment`, "MISSING_CREDENTIAL");
}
/**
* Resolve the balance endpoint facts for the DeepSeek provider route. The
* merged `llm-deepseek` settings section is the single configuration source,
* so a changed base URL or key reference reaches the very next read.
* @param ctx - registrant context carrying the settings service.
* @param provider - the provider route the balance belongs to.
* @returns the request facts; rejects with `MISSING_CREDENTIAL` when no key resolves.
*/
async function resolveBalanceRequest(ctx, provider) {
	const connection = resolveAdapterOptions(ctx.settings.get(settingsNamespace("llm-deepseek")) ?? {}, launchEnvironmentOf(ctx));
	const ref = connection.apiKeyEnv;
	const credentials = ctx.get("credentials");
	let apiKey;
	if (credentials !== void 0) {
		const hit = await credentials.resolve(ref);
		if (hit === void 0) throw noKeyError(provider, ref);
		apiKey = assertUsableApiKey(hit.value, "ui-billing", ref);
	} else {
		const ambient = launchEnvironmentOf(ctx).get(ref);
		if (ambient === void 0 || ambient.value.length === 0) throw noKeyError(provider, ref);
		apiKey = assertUsableApiKey(ambient.value, "ui-billing", ref);
	}
	return {
		provider,
		baseURL: connection.baseURL,
		apiKey,
		userId: String(getOrCreateAnonymousUserId())
	};
}
/** Map a non-2xx balance response status and body to a harness error code (the adapter's own mapping is not package-exported). */
function balanceHttpErrorCode(status, error) {
	if (status === 401 || status === 403) return "AUTH";
	if (status === 413) return "INVALID_REQUEST";
	if (isQuotaExceededError([
		error?.code,
		error?.type,
		error?.message
	].filter(Boolean).join(" "))) return QUOTA_EXCEEDED_CODE;
	if (status === 429) return "RATE_LIMIT";
	if (status === 400) return "INVALID_REQUEST";
	if (status >= 500) return "SERVER";
	return `HTTP_${status}`;
}
/** Map a non-2xx provider response to a normalized LlmError; a malformed error body never masks the status. */
async function balanceHttpError(response) {
	let message = `DeepSeek API error (HTTP ${response.status})`;
	let providerError;
	try {
		providerError = (await response.json()).error;
		if (providerError?.message) message = providerError.message;
	} catch {}
	return new LlmError(message, balanceHttpErrorCode(response.status, providerError), { status: response.status });
}
/**
* Read the provider account balance over HTTP.
* @param request - resolved endpoint facts.
* @param signal - optional caller cancellation; an aborted read rethrows the abort.
* @returns the normalized balance.
*/
async function fetchBalance(request, signal) {
	let response;
	try {
		response = await fetch(`${request.baseURL}/user/balance`, {
			method: "GET",
			headers: {
				authorization: `Bearer ${request.apiKey}`,
				accept: "application/json",
				...attributionHeaders(),
				"x-deepseek-harness-user-id": request.userId
			},
			...signal === void 0 ? {} : { signal }
		});
	} catch (error) {
		if (signal?.aborted) throw error;
		throw new LlmError(`DeepSeek balance request to ${request.baseURL} failed`, "TRANSPORT", { cause: error });
	}
	if (!response.ok) throw await balanceHttpError(response);
	let parsed;
	try {
		parsed = await response.json();
	} catch {
		throw new LlmError("DeepSeek balance endpoint returned an unparseable body", "EMPTY_RESPONSE");
	}
	const info = parsed.balance_infos?.[0];
	if (info === void 0 || typeof info.currency !== "string" || info.currency.length === 0) throw new LlmError("DeepSeek balance endpoint returned no balance entry", "EMPTY_RESPONSE");
	const totalBalance = Number(info.total_balance);
	if (!Number.isFinite(totalBalance)) throw new LlmError("DeepSeek balance endpoint returned a non-numeric total", "EMPTY_RESPONSE");
	const portion = (value) => {
		const parsedValue = value === void 0 ? void 0 : Number(value);
		return parsedValue !== void 0 && Number.isFinite(parsedValue) ? parsedValue : void 0;
	};
	const grantedBalance = portion(info.granted_balance);
	const toppedUpBalance = portion(info.topped_up_balance);
	return {
		provider: request.provider,
		currency: info.currency,
		totalBalance,
		...grantedBalance === void 0 ? {} : { grantedBalance },
		...toppedUpBalance === void 0 ? {} : { toppedUpBalance }
	};
}
//#endregion
//#region lib/types/index.js
/**
* Billing surface plugin, node half: serves the provider account balance to
* the browser half over the `/billing` connection RPC channel. The browser
* half ships via exports["./client"], discovered through the package.json
* `dsh.client` declaration.
*
* @module @huanghanheng/dsh-ui-billing
*/
/** Cordis plugin name. */
const name = "ui-billing";
/** Required services: the connection RPC registry (balance channel) and settings (provider facts). */
const inject = ["connection", "settings"];
/** The balance channel this plugin owns; the browser half calls `balance` on it. */
const BALANCE_CHANNEL = "/billing";
/**
* Host plugin body: register the balance endpoint on the `/billing` channel.
* @param ctx - registrant context carrying the connection and settings services.
*/
function apply(ctx) {
	const handler = async (endpoint, payload, signal) => {
		if (endpoint !== "balance") return {
			ok: false,
			error: {
				code: "internal",
				message: `ui-billing: unknown endpoint "${endpoint}"`,
				details: {}
			}
		};
		const candidate = payload?.provider;
		const provider = typeof candidate === "string" && candidate.length > 0 ? candidate : "deepseek-official";
		try {
			return {
				ok: true,
				value: { balance: await fetchBalance(await resolveBalanceRequest(ctx, provider), signal) }
			};
		} catch (error) {
			return {
				ok: false,
				error: {
					code: "internal",
					message: error instanceof Error ? error.message : String(error),
					details: { provider }
				}
			};
		}
	};
	ctx.connection.rpc.handle(BALANCE_CHANNEL, handler, { authority: "loopback" });
}
//#endregion
export { BALANCE_CHANNEL, apply, inject, name };
