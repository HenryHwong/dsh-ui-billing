import z from "@deepseek-ai/schemastery";
import { getOrCreateAnonymousUserId } from "@deepseek-ai/dsh-anonymous-user-id";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { LlmError, QUOTA_EXCEEDED_CODE, assertUsableApiKey, attributionHeaders, isQuotaExceededError } from "@deepseek-ai/dsh-llm";
import { resolveAdapterOptions } from "@deepseek-ai/dsh-llm-deepseek";
import { z as z$1 } from "zod";
//#region lib/types/seams/settings.js
/**
* Host-side seam over the settings service: the only module naming the
* namespace key type, so a settings-side change stays a single-file edit.
*
* @module @huanghanheng/dsh-ui-billing/seams/settings
*/
/**
* Read one registered settings namespace's resolved value.
* @param ctx - context carrying the settings service.
* @param namespace - registered namespace key.
* @returns the resolved section, or undefined when the namespace is unregistered.
*/
function settingsSection(ctx, namespace) {
	return ctx.settings.get(namespace);
}
//#endregion
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
	const raw = settingsSection(ctx, "llm-deepseek");
	const connection = resolveAdapterOptions(raw ?? {}, launchEnvironmentOf(ctx));
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
	const detail = [
		error?.code,
		error?.type,
		error?.message
	].filter(Boolean).join(" ");
	if (isQuotaExceededError(detail)) return QUOTA_EXCEEDED_CODE;
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
//#region lib/types/projection.js
/**
* The `billing` projection unit owned by the plugin: a pure fold of
* `assistant/message` usage records into whole-log cost and unpriced-token
* totals. Each usage-reporting step is priced by its assembled message's
* `source.model` against the price table captured at composition load; a
* model without an entry (or a tier without a price for the usage instant)
* contributes its tokens to `unpricedTokens` instead of pretending they are
* free. The provider output figure already includes reasoning tokens, so only
* the four billed usage fields are priced.
*
* @module @huanghanheng/dsh-ui-billing/projection
*/
const billingSchema = z$1.object({
	cost: z$1.number().nonnegative(),
	unpricedTokens: z$1.number().int().nonnegative()
}).strict();
/** Local minutes-since-midnight of a UTC epoch-millisecond instant on the price clock. */
function localMinutes(time, utcOffsetMinutes) {
	const daySeconds = ((Math.floor(time / 1e3) + utcOffsetMinutes * 60) % 86400 + 86400) % 86400;
	return Math.floor(daySeconds / 60);
}
/** Whether `minutes` falls inside `[start, end)`; a reversed window wraps midnight. */
function inWindow(minutes, start, end) {
	return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}
/**
* The peak-or-off-peak price for one usage instant. Peak applies only when a
* peak price exists and the instant falls inside a configured peak window;
* everything else uses `offPeak` (the only tier required to show any cost).
* @param tier - the model's price schedule.
* @param time - the usage event's epoch-millisecond time.
* @param cfg - the resolved billing configuration (windows and clock).
* @returns the applicable price, or undefined when the tier has none.
*/
function priceFor(tier, time, cfg) {
	const peak = tier.peak;
	const windows = cfg.peakHours;
	return peak !== void 0 && windows.length > 0 && windows.some(([start, end]) => inWindow(localMinutes(time, cfg.utcOffsetMinutes), start, end)) ? peak : tier.offPeak;
}
/** Non-negative finite numeric field reader; unknown or invalid values read as 0. */
function tokensOf(usage, key) {
	const value = usage[key];
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
/** Total reported tokens of one usage record — the unpriced-token count.
* @param usage - the usage record from an `assistant/message` event.
* @returns the sum of the billed usage fields, or 0 for an absent or malformed record.
*/
function usageTokens(usage) {
	if (typeof usage !== "object" || usage === null) return 0;
	const record = usage;
	let total = 0;
	for (const key of [
		"inputTokens",
		"cacheReadTokens",
		"cacheWriteTokens",
		"outputTokens"
	]) total += tokensOf(record, key);
	return total;
}
/** CNY cost of one usage record at one price (per-million rates).
* @param usage - the usage record from an `assistant/message` event.
* @param price - the applicable per-million-token rates.
* @returns the fractional CNY cost of the billed tokens.
*/
function usageCost(usage, price) {
	if (typeof usage !== "object" || usage === null) return 0;
	const record = usage;
	let cost = tokensOf(record, "inputTokens") * price.inputPerM;
	if (price.cacheReadPerM !== void 0) cost += tokensOf(record, "cacheReadTokens") * price.cacheReadPerM;
	if (price.cacheWritePerM !== void 0) cost += tokensOf(record, "cacheWriteTokens") * price.cacheWritePerM;
	cost += tokensOf(record, "outputTokens") * price.outputPerM;
	return cost / 1e6;
}
/** The `billing` unit for one resolved price table; the fold is a pure function of committed events.
* @param config - the resolved price table and peak windows.
* @returns the projection definition to register on `ctx.sessionProjections`.
*/
function billingProjectionDefinition(config) {
	return {
		key: "billing",
		stateVersion: 4,
		stateSchema: billingSchema,
		init: () => ({
			cost: 0,
			unpricedTokens: 0
		}),
		apply: (state, event) => {
			if (event.type !== "assistant/message") return state;
			const usage = event.data.usage;
			if (usage === void 0) return state;
			const model = event.data.message.source?.model;
			const tier = typeof model === "string" ? config.prices?.[model] : void 0;
			const price = tier === void 0 ? void 0 : priceFor(tier, event.time, config);
			if (price === void 0) {
				const tokens = usageTokens(usage);
				return tokens === 0 ? state : {
					...state,
					unpricedTokens: state.unpricedTokens + tokens
				};
			}
			const cost = usageCost(usage, price);
			return cost === 0 ? state : {
				...state,
				cost: state.cost + cost
			};
		},
		wire: {
			viewSchema: billingSchema,
			view: (state) => ({
				cost: state.cost,
				unpricedTokens: state.unpricedTokens
			})
		}
	};
}
//#endregion
//#region lib/types/seams/connection.js
/**
* Host-side seam over the Connection RPC registry: the only module naming the
* registration contract of the harness Connection service, so a transport-side
* change stays a single-file edit.
*
* @module @huanghanheng/dsh-ui-billing/seams/connection
*/
/**
* Register one channel handler on the Connection RPC registry.
* @param ctx - registrant context.
* @param channel - absolute channel prefix.
* @param handler - decoded endpoint handler.
*/
function registerRpcChannel(ctx, channel, handler) {
	ctx.inject(["connection", "webServer"], (webCtx) => {
		webCtx.connection.rpc.handle(channel, handler);
	});
}
//#endregion
//#region lib/types/index.js
/**
* Billing surface plugin, node half: registers the `billing` session
* projection (whole-log CNY cost against the price table captured at
* composition load) and serves the provider account balance to the browser
* half over the `/billing` connection RPC channel. The browser half ships via
* exports["./client"], discovered through the package.json `dsh.client`
* declaration.
*
* @module @huanghanheng/dsh-ui-billing
*/
/** Cordis plugin name. */
const name = "ui-billing";
/** Required services: connection (RPC registry), settings (provider facts), and session projections are probed dynamically; webServer is injected at registration time. */
const inject = ["connection", "settings"];
/** The balance channel this plugin owns; the browser half calls `balance` on it. */
const BALANCE_CHANNEL = "/billing";
/** Loader schema; a missing field falls back to the shipped defaults. The
* price table passes through `z.any()` because its nested shape is the
* deployment's own (the fold reads it defensively). The default peak windows
* are the official Beijing workday schedule (09:00-12:00, 14:00-18:00); the
* window model cannot exclude weekends, so deployments may clear `peakHours`
* to price everything off-peak. */
const Config = z.object({
	prices: z.any().default({
		"deepseek-chat": { offPeak: {
			inputPerM: 2,
			cacheReadPerM: .5,
			outputPerM: 8
		} },
		"deepseek-reasoner": { offPeak: {
			inputPerM: 4,
			cacheReadPerM: 1,
			outputPerM: 16
		} },
		"deepseek-v4-flash": {
			offPeak: {
				inputPerM: 1,
				cacheReadPerM: .02,
				outputPerM: 4
			},
			peak: {
				inputPerM: 2,
				cacheReadPerM: .04,
				outputPerM: 8
			}
		},
		"deepseek-v4-pro": {
			offPeak: {
				inputPerM: 4.5,
				cacheReadPerM: .15,
				outputPerM: 13.5
			},
			peak: {
				inputPerM: 9,
				cacheReadPerM: .3,
				outputPerM: 27
			}
		},
		"deepseek-v4-flash-vision-exp": {
			offPeak: {
				inputPerM: 1,
				cacheReadPerM: .02,
				outputPerM: 4
			},
			peak: {
				inputPerM: 2,
				cacheReadPerM: .04,
				outputPerM: 8
			}
		}
	}),
	peakHours: z.any().default([[540, 720], [840, 1080]]),
	utcOffsetMinutes: z.number().step(1).default(480)
});
/** Resolve the plugin's config to the projection's closed form. */
function resolveBillingConfig(config) {
	const resolved = Config(config ?? {});
	return {
		prices: resolved.prices,
		peakHours: resolved.peakHours,
		utcOffsetMinutes: resolved.utcOffsetMinutes
	};
}
/**
* Host plugin body: register the balance endpoint on the `/billing` channel
* and, when the composition mounts the projection registry, the `billing`
* cost unit (its registration is an effect on this fiber, so unloading
* removes the key).
* @param ctx - registrant context carrying the connection and settings services.
* @param config - the deployment's price table and peak windows.
*/
function apply(ctx, config) {
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
	registerRpcChannel(ctx, BALANCE_CHANNEL, handler);
	const projections = ctx.get("sessionProjections");
	if (projections !== void 0) projections.register(billingProjectionDefinition(resolveBillingConfig(config)));
}
//#endregion
export { BALANCE_CHANNEL, Config, apply, inject, name };
