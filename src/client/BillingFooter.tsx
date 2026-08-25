/**
 * BillingFooter: the billing widget registered into the sidebar foot action
 * list. Wide mode renders two rows — the currently selected conversation's
 * cost and the provider account balance — with a refresh affordance on the
 * balance row; the collapsed rail renders a single ¥ glyph whose tooltip
 * carries both lines. All live facts arrive through the bound hooks; the
 * only local state is none — the refresh button just invokes the injected
 * callback.
 */

import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { BillingCostSnapshot, BalanceSnapshot } from './sources.ts'
import type { BillingKey } from './locales.ts'
import css from './BillingFooter.module.css'

/** Compact CNY: `¥1.23`; amounts under a cent keep 4 significant decimals. */
export function formatCost(amount: number): string {
  if (amount === 0) return '¥0'
  if (amount >= 1) return `¥${amount.toFixed(2)}`
  return `¥${amount.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`
}

/** Fixed two-decimal balance: `¥110.00`. */
export function formatBalance(currency: string, amount: number): string {
  const sign = currency === 'CNY' ? '¥' : `${currency} `
  return `${sign}${amount.toFixed(2)}`
}

/** The inject face: hooks (renderer-bound to `use<Name>` selectors) plus the refresh verb. */
export interface BillingFooterInjected {
  refreshBalance: () => void
  hooks: {
    billingCost: HostObservable<BillingCostSnapshot>
    balance: HostObservable<BalanceSnapshot>
  }
}

/** Full composed props: owner share (sidebar column state) + locale seat + the injected face (hooks bound). */
export type BillingFooterProps =
  & PropsRuntime<'sidebar.footer.action'>
  & PropsLocale<'billing'>
  & InjectFace<BillingFooterInjected>

/** Render the balance row value: amount, loading ellipsis, or the unavailable note. */
export function balanceText(snapshot: BalanceSnapshot, t: (key: BillingKey) => string): string {
  if (snapshot.status === 'error') return t('balance.unavailable')
  if (snapshot.status !== 'ok' || snapshot.balance === undefined) return t('balance.loading')
  return formatBalance(snapshot.balance.currency, snapshot.balance.totalBalance)
}

/**
 * The sidebar foot billing widget.
 * @param props - composed slot props.
 * @returns the widget tree (wide rows or the rail glyph).
 */
export function BillingFooter({ wide, useBillingCost, useBalance, refreshBalance, t }: BillingFooterProps) {
  const cost = useBillingCost(s => s)
  const balance = useBalance(s => s)
  const costValue = cost === undefined ? '—' : formatCost(cost.cost)
  const costTitle = cost !== undefined && cost.unpricedTokens > 0
    ? `${costValue} (+${cost.unpricedTokens} tokens unpriced)`
    : undefined
  const balanceValue = balanceText(balance, t)

  if (!wide) {
    const tip = `${t('cost.label')} ${costValue} · ${t('balance.label')} ${balanceValue}`
    return (
      <Tooltip label={tip} side="top" delayMs={500}>
        <button
          type="button"
          className={css.railButton}
          aria-label={tip}
          onClick={() => { refreshBalance() }}
          data-billing-rail
        >
          <span aria-hidden>¥</span>
        </button>
      </Tooltip>
    )
  }

  return (
    <div className={css.root} data-billing-footer>
      <div className={css.row} title={costTitle}>
        <span className={css.label}>{t('cost.label')}</span>
        <span className={css.value} data-billing-cost>{costValue}</span>
      </div>
      <div className={css.row}>
        <span className={css.label}>{t('balance.label')}</span>
        <span className={css.value} data-billing-balance>{balanceValue}</span>
        <Tooltip label={t('balance.refresh')} side="top" delayMs={500}>
          <button
            type="button"
            className={css.refresh}
            aria-label={t('balance.refresh')}
            onClick={() => { refreshBalance() }}
            data-billing-refresh
          >
            <IconRefreshOutline16 size={12} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
