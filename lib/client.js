window.__ModuleLoader__.load({
	id: "@huanghanheng/dsh-ui-billing",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:/home/henry/code/deepseek-harness/packages/client/ui-billing-pub/src/client/BillingFooter.module.css.mjs
		const css = ".G2O8ia_root{border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);flex-direction:column;gap:2px;padding:8px 12px;font-size:12px;line-height:18px;display:flex}.G2O8ia_row{align-items:center;gap:6px;min-width:0;display:flex}.G2O8ia_label{white-space:nowrap;flex:none}.G2O8ia_value{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;overflow:hidden}.G2O8ia_refresh{cursor:pointer;width:18px;height:18px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:4px;justify-content:center;align-items:center;margin-left:auto;padding:0;display:inline-flex}.G2O8ia_refresh:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.G2O8ia_railButton{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;justify-content:center;align-items:center;padding:0;font-size:13px;display:flex}.G2O8ia_railButton:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}";
		const tagId = "@huanghanheng/dsh-ui-billing/BillingFooter.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@huanghanheng/dsh-ui-billing";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var BillingFooter_module_css_default = {
			"label": "G2O8ia_label",
			"railButton": "G2O8ia_railButton",
			"refresh": "G2O8ia_refresh",
			"root": "G2O8ia_root",
			"row": "G2O8ia_row",
			"value": "G2O8ia_value"
		};
		//#endregion
		//#region src/client/BillingFooter.tsx
		/**
		* BillingFooter: the billing widget registered into the sidebar foot action
		* list. Wide mode renders two rows — the currently selected conversation's
		* cost and the provider account balance — with a refresh affordance on the
		* balance row; the collapsed rail renders a single ¥ glyph whose tooltip
		* carries both lines. All live facts arrive through the bound hooks; the
		* only local state is none — the refresh button just invokes the injected
		* callback.
		*/
		/** Compact CNY: `¥1.23`; amounts under a cent keep 4 significant decimals. */
		function formatCost(amount) {
			if (amount === 0) return "¥0";
			if (amount >= 1) return `¥${amount.toFixed(2)}`;
			return `¥${amount.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
		}
		/** Fixed two-decimal balance: `¥110.00`. */
		function formatBalance(currency, amount) {
			return `${currency === "CNY" ? "¥" : `${currency} `}${amount.toFixed(2)}`;
		}
		/** Render the balance row value: amount, loading ellipsis, or the unavailable note. */
		function balanceText(snapshot, t) {
			if (snapshot.status === "error") return t("balance.unavailable");
			if (snapshot.status !== "ok" || snapshot.balance === void 0) return t("balance.loading");
			return formatBalance(snapshot.balance.currency, snapshot.balance.totalBalance);
		}
		/**
		* The sidebar foot billing widget.
		* @param props - composed slot props.
		* @returns the widget tree (wide rows or the rail glyph).
		*/
		function BillingFooter({ wide, useBillingCost, useBalance, refreshBalance, t }) {
			const cost = useBillingCost((s) => s);
			const balance = useBalance((s) => s);
			const costValue = cost === void 0 ? "—" : formatCost(cost.cost);
			const costTitle = cost !== void 0 && cost.unpricedTokens > 0 ? `${costValue} (+${cost.unpricedTokens} tokens unpriced)` : void 0;
			const balanceValue = balanceText(balance, t);
			if (!wide) {
				const tip = `${t("cost.label")} ${costValue} · ${t("balance.label")} ${balanceValue}`;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: tip,
					side: "top",
					delayMs: 500,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: BillingFooter_module_css_default.railButton,
						"aria-label": tip,
						onClick: () => {
							refreshBalance();
						},
						"data-billing-rail": true,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": true,
							children: "¥"
						})
					})
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: BillingFooter_module_css_default.root,
				"data-billing-footer": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: BillingFooter_module_css_default.row,
					title: costTitle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: BillingFooter_module_css_default.label,
						children: t("cost.label")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: BillingFooter_module_css_default.value,
						"data-billing-cost": true,
						children: costValue
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: BillingFooter_module_css_default.row,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: BillingFooter_module_css_default.label,
							children: t("balance.label")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: BillingFooter_module_css_default.value,
							"data-billing-balance": true,
							children: balanceValue
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("balance.refresh"),
							side: "top",
							delayMs: 500,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: BillingFooter_module_css_default.refresh,
								"aria-label": t("balance.refresh"),
								onClick: () => {
									refreshBalance();
								},
								"data-billing-refresh": true,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 12 })
							})
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** `billing` namespace dictionaries. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"cost.label": "本对话费用",
			"balance.label": "API 余额",
			"balance.loading": "查询中…",
			"balance.unavailable": "余额不可用",
			"balance.refresh": "刷新余额"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"cost.label": "Chat cost",
			"balance.label": "API balance",
			"balance.loading": "Loading…",
			"balance.unavailable": "Balance unavailable",
			"balance.refresh": "Refresh balance"
		};
		//#endregion
		//#region src/client/sources.ts
		/**
		* The balance channel the node half registers. A protocol constant the
		* browser half cannot import from the node half (client bundle purity), so
		* both halves keep the same literal.
		*/
		const BALANCE_CHANNEL = "/billing";
		/** Balance polling interval while the widget is mounted. */
		const BALANCE_REFRESH_MS = 6e4;
		/**
		* Follow the current session's `billing` projection. Selection changes rebind
		* the projection face; face changes re-read the snapshot. The runtime's
		* current-provide info is the single selection authority, so this source
		* subscribes to it and never to the list store.
		* @param sessions - the sessions service face.
		* @returns the cost source.
		*/
		function createBillingCostSource(sessions) {
			let currentSession;
			let face;
			let unsubscribeFace;
			let value;
			const listeners = /* @__PURE__ */ new Set();
			const notify = () => {
				for (const fn of [...listeners]) fn();
			};
			const sync = () => {
				const nextSession = sessions.currentProvideInfo.getSnapshot().hooks.session;
				if (nextSession === currentSession) {
					if (face !== void 0) {
						const next = face.getSnapshot();
						if (next !== value) {
							value = next;
							notify();
						}
					}
					return;
				}
				currentSession = nextSession;
				unsubscribeFace?.();
				face = nextSession === void 0 ? void 0 : nextSession.projections.faceOf("billing");
				value = face === void 0 ? void 0 : face.getSnapshot();
				unsubscribeFace = face?.subscribe(sync);
				notify();
			};
			const unsubscribeCurrent = sessions.currentProvideInfo.subscribe(sync);
			sync();
			return {
				getSnapshot: () => value,
				subscribe: (fn) => {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				dispose: () => {
					unsubscribeCurrent();
					unsubscribeFace?.();
				}
			};
		}
		/**
		* Read the provider account balance through the `/billing` connection
		* channel. Subscribers start the refresh loop (immediate read + interval);
		* the last subscriber stops it.
		* @param rpc - the connection's generic channel caller.
		* @returns the balance source.
		*/
		function createBalanceSource(rpc) {
			let snapshot = { status: "idle" };
			let inflight;
			let timer;
			const listeners = /* @__PURE__ */ new Set();
			const notify = () => {
				for (const fn of [...listeners]) fn();
			};
			const refresh = async () => {
				if (inflight !== void 0) return inflight;
				snapshot = {
					...snapshot,
					status: "loading"
				};
				notify();
				inflight = (async () => {
					try {
						const response = await rpc.call(BALANCE_CHANNEL, "balance", {});
						if (response.ok) {
							const value = response.value;
							snapshot = value?.balance === void 0 ? { status: "ok" } : {
								status: "ok",
								balance: value.balance
							};
						} else snapshot = {
							status: "error",
							error: response.error.message
						};
					} catch (error) {
						snapshot = {
							status: "error",
							error: error instanceof Error ? error.message : String(error)
						};
					}
				})().finally(() => {
					inflight = void 0;
				});
				await inflight;
				notify();
			};
			const stop = () => {
				if (timer !== void 0) {
					clearInterval(timer);
					timer = void 0;
				}
			};
			const start = () => {
				/* v8 ignore next -- defensive re-entry guard: subscribe gates start() to the first subscriber, so no second call sees a live timer. */
				if (timer !== void 0) return;
				refresh();
				timer = setInterval(() => {
					refresh();
				}, BALANCE_REFRESH_MS);
			};
			return {
				getSnapshot: () => snapshot,
				subscribe: (fn) => {
					listeners.add(fn);
					if (listeners.size === 1) start();
					return () => {
						listeners.delete(fn);
						if (listeners.size === 0) stop();
					};
				},
				refresh
			};
		}
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "billing";
		/** Required services: the slot ledger, sessions (selection + projections), the connection (balance channel), and copy. */
		const inject = [
			"slots",
			"sessions",
			"connection",
			"locale"
		];
		/**
		* Client plugin body: register the dictionaries and the sidebar-foot widget.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-billing: dictionaries");
			const handle = ctx.get("connection");
			const costSource = createBillingCostSource(ctx.sessions);
			const balanceSource = createBalanceSource(handle.rpc);
			ctx.effect(() => ctx.on("connection/reset", () => {
				balanceSource.refresh();
			}), "ui-billing: balance invalidation");
			ctx.effect(() => () => {
				costSource.dispose();
			}, "ui-billing: cost source disposal");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "billing",
				order: 0,
				locale: NS,
				inject: () => ({
					refreshBalance: () => {
						balanceSource.refresh();
					},
					hooks: {
						billingCost: costSource,
						balance: balanceSource
					}
				})
			}, BillingFooter));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map