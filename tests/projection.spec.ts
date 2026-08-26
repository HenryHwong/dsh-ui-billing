/**
 * The `billing` projection unit: pure pricing helpers (usage tokens/cost and
 * peak-window selection) plus the definition fold over synthetic
 * `assistant/message` usage records, and the plugin's registration wiring on
 * a real cordis Context with a fake projection registry.
 */
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { apply, Config, inject } from '../src/index.ts'
import { billingProjectionDefinition, priceFor, usageCost, usageTokens } from '../src/projection.ts'
import type { ResolvedBillingConfig, TieredModelPrice } from '../src/projection.ts'

const DEEPSEEK_CHAT: TieredModelPrice = { offPeak: { inputPerM: 2, cacheReadPerM: 0.5, outputPerM: 8 } }

function resolved(overrides: Partial<ResolvedBillingConfig> = {}): ResolvedBillingConfig {
  return { prices: { 'mock': DEEPSEEK_CHAT }, peakHours: [], utcOffsetMinutes: 480, ...overrides }
}

function totals(cost = 0, unpricedTokens = 0): { cost: number; unpricedTokens: number } {
  return { cost, unpricedTokens }
}

function usageEvent(seq: number, model: string, usage: object, time = 0): SessionEvent {
  return {
    type: 'assistant/message',
    seq,
    time,
    data: {
      turn: 1,
      step: seq,
      message: {
        role: 'assistant',
        content: [],
        source: { provider: 'deepseek-official', model },
      },
      usage,
    },
  } as unknown as SessionEvent
}

function fold(events: SessionEvent[], config: ResolvedBillingConfig = resolved()) {
  const definition = billingProjectionDefinition(config)
  let state = definition.init()
  for (const event of events) state = definition.apply(state, event)
  return state
}

describe('usageTokens', () => {
  it('sums the four billed fields and reads absent or malformed records as 0', () => {
    expect(usageTokens({ inputTokens: 100, cacheReadTokens: 200, cacheWriteTokens: 50, outputTokens: 300 })).toBe(650)
    expect(usageTokens({ inputTokens: 0, outputTokens: -5 })).toBe(0)
    expect(usageTokens(undefined)).toBe(0)
    expect(usageTokens(null)).toBe(0)
  })
})

describe('usageCost', () => {
  it('prices each field at its per-million rate', () => {
    const price = DEEPSEEK_CHAT.offPeak!
    expect(usageCost({ inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 }, price))
      .toBe(2 + 0.5 + 8)
  })

  it('skips cache fields the tier does not price', () => {
    const price = { inputPerM: 2, outputPerM: 8 }
    expect(usageCost({ inputTokens: 1_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000, outputTokens: 1_000_000 }, price))
      .toBe(10)
  })
})

describe('priceFor', () => {
  const cfg = resolved({
    peakHours: [[9 * 60, 18 * 60]],
    utcOffsetMinutes: 0,
  })

  it('applies peak only inside a configured window when a peak tier exists', () => {
    const tier: TieredModelPrice = { peak: { inputPerM: 22, outputPerM: 88 }, offPeak: DEEPSEEK_CHAT.offPeak }
    expect(priceFor(tier, Date.UTC(2026, 7, 17, 10, 0), cfg)).toBe(tier.peak)
    expect(priceFor(tier, Date.UTC(2026, 7, 17, 8, 59), cfg)).toBe(tier.offPeak)
    expect(priceFor(tier, Date.UTC(2026, 7, 17, 18, 0), cfg)).toBe(tier.offPeak)
  })

  it('stays off-peak when the tier has no peak price or no window is configured', () => {
    expect(priceFor(DEEPSEEK_CHAT, Date.UTC(2026, 7, 17, 10, 0), cfg)).toBe(DEEPSEEK_CHAT.offPeak)
    expect(priceFor(DEEPSEEK_CHAT, Date.UTC(2026, 7, 17, 10, 0), resolved())).toBe(DEEPSEEK_CHAT.offPeak)
  })

  it('wraps a reversed (midnight-crossing) window', () => {
    const midnight = resolved({ peakHours: [[22 * 60, 6 * 60]], utcOffsetMinutes: 0 })
    const tier: TieredModelPrice = { peak: { inputPerM: 22, outputPerM: 88 }, offPeak: DEEPSEEK_CHAT.offPeak }
    expect(priceFor(tier, Date.UTC(2026, 7, 17, 23, 0), midnight)).toBe(tier.peak)
    expect(priceFor(tier, Date.UTC(2026, 7, 17, 5, 0), midnight)).toBe(tier.peak)
    expect(priceFor(tier, Date.UTC(2026, 7, 17, 12, 0), midnight)).toBe(tier.offPeak)
  })
})

describe('billing fold', () => {
  it('accumulates cost across priced steps and ignores non-usage events', () => {
    const events = [
      usageEvent(0, 'mock', { inputTokens: 1000, outputTokens: 2000 }),
      { type: 'turn/start', seq: 1, time: 0, data: {} } as unknown as SessionEvent,
      usageEvent(2, 'mock', { inputTokens: 1000, cacheReadTokens: 1000, outputTokens: 2000 }),
    ]
    expect(fold(events)).toEqual(totals((1000 * 2 + 2000 * 8 + 1000 * 2 + 1000 * 0.5 + 2000 * 8) / 1e6))
  })

  it('counts unpriced models as unpriced tokens instead of pretending they are free', () => {
    const events = [
      usageEvent(0, 'mock', { inputTokens: 1000, outputTokens: 500 }),
      usageEvent(1, 'unknown-model', { inputTokens: 1000, outputTokens: 500 }),
    ]
    expect(fold(events)).toEqual(totals((1000 * 2 + 500 * 8) / 1e6, 1500))
  })

  it('returns the same state reference for an uninteresting event', () => {
    const definition = billingProjectionDefinition(resolved())
    const state = definition.init()
    expect(definition.apply(state, { type: 'turn/start', seq: 0, time: 0, data: {} } as unknown as SessionEvent))
      .toBe(state)
    expect(definition.apply(state, { type: 'assistant/message', seq: 0, time: 0, data: { turn: 1, step: 0, message: { role: 'assistant', content: [], source: { provider: 'p', model: 'mock' } } } } as unknown as SessionEvent))
      .toBe(state)
  })
})

describe('plugin registration', () => {
  it('registers the billing unit when the composition mounts the projection registry', async () => {
    const register = vi.fn((definition: { key: string; stateVersion: number }) => () => {})
    const ctx = new Context()
    ctx.provide('connection', { rpc: { handle: vi.fn(() => async () => {}) } } as never)
    ctx.provide('settings', { get: () => ({}) } as never)
    ctx.provide('sessionProjections', { register } as never)
    const fiber = ctx.plugin({ inject, apply })
    await fiber.await()
    try {
      expect(register).toHaveBeenCalledTimes(1)
      const definition = register.mock.calls[0]![0]
      expect(definition.key).toBe('billing')
      expect(definition.stateVersion).toBe(3)
    } finally {
      await fiber.dispose()
    }
  })

  it('defaults cover the full advertised deepseek adapter catalog', () => {
    const prices = Config({} as Config).prices
    for (const model of [
      'deepseek-chat',
      'deepseek-reasoner',
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'deepseek-v4-flash-vision-exp',
    ]) {
      expect(prices[model]?.offPeak).toBeDefined()
    }
  })

  it('defaults carry the current official V4 schedule with the Beijing peak windows', () => {
    const config = Config({} as Config)
    expect(config.prices['deepseek-v4-flash']).toEqual({
      offPeak: { inputPerM: 1.5, cacheReadPerM: 0.05, outputPerM: 4.5 },
      peak: { inputPerM: 3, cacheReadPerM: 0.1, outputPerM: 9 },
    })
    expect(config.prices['deepseek-v4-pro']).toEqual({
      offPeak: { inputPerM: 4.5, cacheReadPerM: 0.15, outputPerM: 13.5 },
      peak: { inputPerM: 9, cacheReadPerM: 0.3, outputPerM: 27 },
    })
    expect(config.peakHours).toEqual([[540, 720], [840, 1080]])
    expect(config.utcOffsetMinutes).toBe(480)
  })
})
