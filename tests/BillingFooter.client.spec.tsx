// @vitest-environment jsdom
/**
 * BillingFooter presentation: wide mode renders the cost and balance rows
 * with a refresh affordance, the collapsed rail renders a single ¥ glyph
 * whose tooltip carries both lines, and the pure formatters/read-state
 * mapper cover the edge amounts and the unavailable/loading reads.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { BillingFooter, balanceText, formatBalance, formatCost } from '../src/client/BillingFooter.tsx'
import type { BillingFooterProps } from '../src/client/BillingFooter.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as BillingFooterProps['t']

/** Selector-hook stub: serves one fixed snapshot to any selector. */
function selectorHook<T>(value: T): SnapshotSelectorHook<T> {
  return ((sel) => {
    if (sel === undefined) return value
    return (sel as (snapshot: T) => unknown)(value)
  }) as SnapshotSelectorHook<T>
}

function props(overrides: Partial<BillingFooterProps> = {}): BillingFooterProps {
  return {
    wide: true,
    useBillingCost: selectorHook({ cost: 1.234, unpricedTokens: 0 }) as unknown as BillingFooterProps['useBillingCost'],
    useBalance: selectorHook({ status: 'ok', balance: { currency: 'CNY', totalBalance: 110.0 } }) as unknown as BillingFooterProps['useBalance'],
    refreshBalance: vi.fn(),
    t,
    ...overrides,
  } as BillingFooterProps
}

describe('formatting helpers', () => {
  it('formats cost compactly and balance with two decimals', () => {
    expect(formatCost(0)).toBe('¥0')
    expect(formatCost(1.234)).toBe('¥1.23')
    expect(formatCost(0.00123)).toBe('¥0.0012')
    expect(formatCost(0.00012)).toBe('¥0.0001')
    expect(formatBalance('CNY', 110)).toBe('¥110.00')
    expect(formatBalance('USD', 5.5)).toBe('USD 5.50')
  })

  it('maps the read state to the row text', () => {
    expect(balanceText({ status: 'error', error: 'nope' }, t)).toBe('余额不可用')
    expect(balanceText({ status: 'loading' }, t)).toBe('查询中…')
    expect(balanceText({ status: 'idle' }, t)).toBe('查询中…')
    expect(balanceText({ status: 'ok', balance: { currency: 'CNY', totalBalance: 3 } }, t)).toBe('¥3.00')
  })
})

describe('BillingFooter', () => {
  it('renders the cost and balance rows with a refresh button', () => {
    const refreshBalance = vi.fn()
    render(<BillingFooter {...props({ refreshBalance })} />)
    expect(screen.getByText('本对话费用')).toBeTruthy()
    expect(screen.getByText('¥1.23')).toBeTruthy()
    expect(screen.getByText('API 余额')).toBeTruthy()
    expect(screen.getByText('¥110.00')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('刷新余额'))
    expect(refreshBalance).toHaveBeenCalledTimes(1)
  })

  it('annotates the cost title when unpriced tokens settled', () => {
    render(<BillingFooter {...props({
      useBillingCost: selectorHook({ cost: 1.234, unpricedTokens: 42 }) as unknown as BillingFooterProps['useBillingCost'],
    })} />)
    expect(screen.getByTitle('¥1.23 (+42 tokens unpriced)')).toBeTruthy()
  })

  it('shows the unavailable note for a failed balance read', () => {
    render(<BillingFooter {...props({ useBalance: selectorHook({ status: 'error', error: 'x' }) as unknown as BillingFooterProps['useBalance'] })} />)
    expect(screen.getByText('余额不可用')).toBeTruthy()
  })

  it('shows the loading note while the first read is in flight', () => {
    render(<BillingFooter {...props({
      useBalance: selectorHook({ status: 'loading' }) as unknown as BillingFooterProps['useBalance'],
      useBillingCost: selectorHook(undefined) as unknown as BillingFooterProps['useBillingCost'],
    })} />)
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText('查询中…')).toBeTruthy()
  })

  it('renders a single rail glyph that refreshes on click when collapsed', () => {
    const refreshBalance = vi.fn()
    render(<BillingFooter {...props({ wide: false, refreshBalance })} />)
    expect(screen.queryByText('本对话费用')).toBeNull()
    const rail = screen.getByLabelText(/本对话费用/)
    fireEvent.click(rail)
    expect(refreshBalance).toHaveBeenCalledTimes(1)
  })
})
