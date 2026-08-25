# dsh-ui-billing

> **🌐 Language / 语言：** [**English**](README.md) · [简体中文](README.zh.md)

Billing widget plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI: one entry at the sidebar foot showing the currently selected conversation's cost — from the `billing` session projection — and the provider account balance — from the `/billing` connection channel.

**GitHub topics**: `dsh-plugin` · `deepseek-harness`

---

## Features

- **Current-session cost.** The wide sidebar renders a labeled row with the selected conversation's whole-log priced cost (CNY). Switching sessions swaps the figure; paging and compaction never change it. A session with unpriced tokens annotates the amount with `(+N tokens unpriced)`.
- **Live API balance.** The balance row reads the provider account through the harness's own connection facts (merged `llm-deepseek` settings + launch environment + credential seam) and refreshes every 60 seconds while mounted, on connection reset, and on demand via the row's refresh button.
- **Collapsed-rail glyph.** When the sidebar is collapsed the widget renders a single ¥ glyph whose tooltip carries both lines; clicking it refreshes the balance.
- **Idle by default.** Nothing is fetched while no subscriber is mounted — the balance poll starts with the first subscriber and stops with the last.

## Security

- **Display only.** The widget renders facts already present in the session projection or the provider account. It never produces a model-visible input, never writes the session log, and emits no new RPCs beyond the read-only `/billing` balance channel the node half registers under the loopback authority.
- **Model Experience**: nothing reaches a model request; token effect none; KV-cache effect none.
- **Credentials stay host-side.** The API key is resolved by the host half through the harness's credentials service or launch environment — the same seam the DeepSeek provider adapter uses — and never enters the browser bundle.

## Requirements

- A DeepSeek Harness checkout or published `@deepseek-ai/dsh-*` packages at `0.1.1-rc.2` or newer, running the web profile.
- **Host billing projection**: the cost row reads the `billing` session projection, provided by the harness's `@deepseek-ai/dsh-billing` plugin (shipping with harness 0.1.1). Without it the plugin still loads and the balance row works; the cost row shows `—`.
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
  "dependencies": { "@huanghanheng/dsh-ui-billing": "^0.1.0" },
  "dsh": { "profile": { "bundles": ["@huanghanheng/dsh-ui-billing"] } }
}
```

Or simply run `dsh plugin --profile web add @huanghanheng/dsh-ui-billing`, which performs the install and the bundle-layer reconciliation for you (equivalent to Route 1).

## Model Experience

#### What the model sees

Nothing. The widget reads the `billing` projection and the `/billing` balance channel — both display-only surfaces over data already in the session log or the provider account.

#### Token effect

None.

#### KV Cache effect

None.

## Development

```sh
pnpm install
pnpm vitest run tests/        # unit tests (component + sources, jsdom; node half, node)
pnpm exec tsc -p tsconfig.json        # typecheck the browser half + client tests
pnpm exec tsc -p tsconfig.host.json   # typecheck the node half + host tests
pnpm bundle                   # tsdown client bundle (needs a harness checkout for the clientBundle preset)
```

The repository compiles `src/` against published `@deepseek-ai/dsh-*` packages; the type-only `@deepseek-ai/dsh-billing/client` import is mirrored under `types/dsh-billing/client.d.ts` until the harness release publishes that package. The two halves typecheck as separate programs, matching the harness's host/client project split. The tests cover the balance read (HTTP normalization, credential resolution), the observable sources (projection following, polling lifecycle), the component (rows, refresh, rail glyph), and the node half on a real cordis context. The browser half's full-context registration spec lives in the harness checkout: published client bundles are ModuleLoader registrations, so a plain vitest import cannot load the runtime's slot services.

## Known Limitations and Deferred Work

- The balance row shows the first provider route's balance when none is specified (`deepseek-official` is the default); multi-provider deployments cannot yet pick a route from the widget (the channel accepts `provider`, so a future selector is a client-only change).
- The cost figure prices usage at the price table captured by the `billing` projection plugin at composition load; see that package's README for the defaults and the override shape.

## License

MIT
