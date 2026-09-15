# dsh-ui-billing

> **🌐 Language / 语言：** [**English**](README.md) · [简体中文](README.zh.md)

Billing widget plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI: one entry at the sidebar foot showing the currently selected conversation's cost — from the `billing` session projection this plugin registers — and the provider account balance — from the node half's `/api/billing.balance` endpoint.

**GitHub topics**: `dsh-plugin` · `deepseek-harness`

---

## Features

- **Current-session cost.** The node half folds every `assistant/message` usage record into the `billing` session projection (whole-log CNY cost plus unpriced tokens) against the price table captured at composition load, and the wide sidebar renders a labeled row with the selected conversation's figure. Switching sessions swaps the figure; paging and compaction never change it. A session with unpriced tokens annotates the amount with `(+N tokens unpriced)`.
- **Live API balance.** The balance row reads the provider account through the harness's own connection facts (merged `llm-deepseek` settings + launch environment + credential seam) and refreshes every 60 seconds while mounted, on connection reset, and on demand via the row's refresh button.
- **Collapsed-rail glyph.** When the sidebar is collapsed the widget renders a single ¥ glyph whose tooltip carries both lines; clicking it refreshes the balance.
- **Idle by default.** Nothing is fetched while no subscriber is mounted — the balance poll starts with the first subscriber and stops with the last.

## Pricing

The cost fold prices each usage-reporting step by its assembled message's `source.model` against the plugin's default CNY-per-million-token table. The V4 catalog follows the current official schedule, the 2026-09-10 flash-series adjustment included (cache-miss input / cache read / output, off-peak rates; the official peak windows are Beijing time Mon–Fri 09:00–12:00 and 14:00–18:00, doubling every field):

| model | input (cache miss) | cache read | output |
| --- | --- | --- | --- |
| `deepseek-flash` | 1 | 0.02 | 4 |
| `deepseek-v4-flash` | 1 | 0.02 | 4 |
| `deepseek-v4-pro` | 4.5 | 0.15 | 13.5 |
| `deepseek-v4-flash-vision-exp` | 1 | 0.02 | 4 |

`deepseek-chat` / `deepseek-reasoner` keep the V3-era anchors (2/0.5/8 and 4/1/16) to cover legacy usage records; the current API catalog is V4 only. `deepseek-flash` is the current model id (DeepSeek-V4.1-Flash), and the retired `deepseek-v4-flash` / `deepseek-v4-flash-vision-exp` names still resolve to it at the Flash price. A model without an entry contributes its tokens to `unpricedTokens` instead of pretending they are free, so a GUI can say "cost" without pretending unknown-priced models are free. Peak-hour pricing is on by default: `peakHours` defaults to the official windows `[[540, 720], [840, 1080]]` (minutes since midnight of the price clock) with `utcOffsetMinutes` 480 (Beijing). The window model cannot exclude weekends, so a deployment needing exact weekend off-peak pricing should clear `peakHours` or override it. Prices are the deployment's responsibility and must track the provider's current schedule — override the whole table with the plugin `config.prices`:

```yaml
- id: ui-billing
  name: '@huanghanheng/dsh-ui-billing'
  config:
    prices:
      'deepseek-v4-pro':
        offPeak: { inputPerM: 4.5, cacheReadPerM: 0.15, outputPerM: 13.5 }
        peak: { inputPerM: 9, cacheReadPerM: 0.3, outputPerM: 27 }
    peakHours: [[540, 720], [840, 1080]]
    utcOffsetMinutes: 480
```

The projection's `stateVersion` is bumped whenever the fold semantics or default table change, so the harness projection cache discards rows folded under an older table and refolds the full log — historical conversations are always repriced consistently at the current table.

## Security

- **Display only.** The widget renders facts already present in the session projection or the provider account. It never produces a model-visible input, never writes the session log, and emits no new RPCs beyond the read-only `/api/billing.balance` endpoint the node half registers on the harness connection transport, whose Host/Origin trust fence admits loopback by default.
- **Model Experience**: nothing reaches a model request; token effect none; KV-cache effect none.
- **Credentials stay host-side.** The API key is resolved by the host half through the harness's credentials service or launch environment — the same seam the DeepSeek provider adapter uses — and never enters the browser bundle.

## Requirements

- A DeepSeek Harness checkout or published `@deepseek-ai/dsh-*` packages at `0.1.5-alpha.1` or newer, running the web profile.
- **Projection registry composed**: the cost row reads the `billing` projection the node half registers, which requires the harness's session-projection seam (`@deepseek-ai/dsh-session-projection`, part of the web-app bundle). Without it the plugin still loads and the balance row works; the cost row shows `—`.
- **A DeepSeek API key**: configured through the harness's credentials service (the web Models page writes it) or exported in the launching environment, as `DEEPSEEK_API_KEY` (the `llm-deepseek` route's default key reference).
- No host instrumentation is required: the `sidebar.footer.action` slot the widget registers into ships in the published `@deepseek-ai/dsh-client-ui-sidebar`.

## Installation

The plugin installs into the web profile like any other DSH bundle; no source edits to the harness checkout are needed.

### Route 1 — bundle install via `dsh plugin` (recommended)

This repository is a [DSH bundle](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md): its `package.json` declares `dsh.bundle.patch` → `./cordis.patch.yml`, so the profile plugin manager installs it as a patch layer and the patch inserts the plugin into the web profile's browser roster.

```sh
# From the git repository (no npm publish needed):
dsh plugin --profile web add @huanghanheng/dsh-ui-billing

# Or, once published to npm (shorter spec):
dsh plugin --profile web add @huanghanheng/dsh-ui-billing
```

`dsh plugin` runs `pnpm add` in the profile directory and reconciles `dsh.profile.bundles` automatically: a dependency whose manifest declares `dsh.bundle.patch` joins the layer stack.

### Route 2 — manual npm install

The package publishes to npm with build artifacts committed (`lib/`), so it installs like any package:

```sh
# In the profile directory the app runs from (or the app itself):
npm install @huanghanheng/dsh-ui-billing
# or: pnpm add @huanghanheng/dsh-ui-billing
```

A manual `npm install` does **not** add the bundle layer automatically — declare it in the profile manifest so the patch inserts the plugin row:

```json
// $DSH_HOME/profiles/web/package.json
{
  "dependencies": { "@huanghanheng/dsh-ui-billing": "^0.2.0" },
  "dsh": { "profile": { "bundles": ["@huanghanheng/dsh-ui-billing"] } }
}
```

Or simply run `dsh plugin --profile web add @huanghanheng/dsh-ui-billing`, which performs the install and the bundle-layer reconciliation for you (equivalent to Route 1).

## Model Experience

#### What the model sees

Nothing. The widget reads the `billing` projection and the `/api/billing.balance` endpoint — both display-only surfaces over data already in the session log or the provider account.

#### Token effect

None.

#### KV Cache effect

None.

## Development

```sh
pnpm install
pnpm test                    # vitest: node half + host tests (projection fold, balance read, registration)
pnpm exec tsc -p tsconfig.json        # typecheck the browser half + client tests
pnpm exec tsc -p tsconfig.host.json   # typecheck the node half + host tests
pnpm build                   # tsc emit to lib/types + tsdown bundles for the node half
```

The repository compiles `src/` against published `@deepseek-ai/dsh-*` packages; the type-only `@deepseek-ai/dsh-billing/client` import is mirrored under `types/dsh-billing/client.d.ts` (this plugin owns that projection wire view). The two halves typecheck as separate programs, matching the harness's host/client project split. `pnpm build` covers the node half; the browser half ships as the committed `lib/client.js`, built inside a harness checkout with the harness's `clientBundle` preset. The tests cover the projection fold (pricing helpers, peak windows, unpriced models, registration wiring), the balance read (HTTP normalization, credential resolution), the observable sources and their seams (projection following, selection movement, polling lifecycle), the component (rows, refresh, rail glyph), and the node half on a real cordis context. The browser half's full-context registration spec lives in the harness checkout: published client bundles are ModuleLoader registrations, so a plain vitest import cannot load the renderer's slot services.

## Known Limitations and Deferred Work

- The balance row shows the first provider route's balance when none is specified (`deepseek-official` is the default); multi-provider deployments cannot yet pick a route from the widget (the channel accepts `provider`, so a future selector is a client-only change).
- The default price table is a static snapshot of the current official V4 CNY schedule (including the Beijing workday peak windows). The deployment must override `config.prices` when the provider changes rates — verify against the provider's current pricing page.
- A provider-billed reasoning surcharge is not modeled separately: the adapter reports `outputTokens` already including reasoning tokens, so only the four billed usage fields are priced.

## License

MIT
