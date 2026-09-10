/**
 * Billing surface plugin, browser half: one widget at the sidebar foot
 * showing the currently selected conversation's cost (from the `billing`
 * session projection) and the provider account balance (from the node half's
 * `billing.balance` endpoint). The widget owns no store and no event listener:
 * the cost source follows the current-session projection face, and the balance
 * source polls while mounted.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the sessions service's Context merge (ctx.sessions).
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the renderer's slots service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls ui-sidebar's SlotMap merge (the 'sidebar.footer.action'
// entry the widget registers into).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the `billing` SessionProjectionMap key merge.
import type {} from '@deepseek-ai/dsh-billing/client'
import { BillingFooter } from './BillingFooter.tsx'
import { en, zh, type BillingKey } from './locales.ts'
import { readProviderBalance } from './seams/connection.ts'
import { currentSessionProjection } from './seams/sessions.ts'
import { createBalanceSource, createBillingCostSource } from './sources.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The billing widget's copy. */
    billing: BillingKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'billing'

/** Required services: the slot ledger, sessions (selection + projections), the connection (transport reset), and copy. */
export const inject = ['slots', 'sessions', 'connection', 'locale']

/**
 * Client plugin body: register the dictionaries and the sidebar-foot widget.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-billing: dictionaries')

  const costSource = createBillingCostSource(currentSessionProjection(ctx.sessions))
  const balanceSource = createBalanceSource(readProviderBalance)
  // The account read is transport-owned: a reconnect invalidates a stale
  // balance, so re-read once the link is back (same lane as
  // ui-settings-general's metadata invalidations).
  ctx.effect(() => ctx.on('connection/reset', () => {
    void balanceSource.refresh()
  }), 'ui-billing: balance invalidation')
  // Release the projection-face subscription on unload (HMR safety).
  ctx.effect(() => () => {
    costSource.dispose()
  }, 'ui-billing: cost source disposal')

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'billing',
    order: 0,
    locale: NS,
    inject: () => ({
      refreshBalance: () => { void balanceSource.refresh() },
      hooks: {
        billingCost: costSource,
        balance: balanceSource,
      },
    }),
  }, BillingFooter))
}
