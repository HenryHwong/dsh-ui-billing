/**
 * The current-session projection seam: the selected id comes off the sessions
 * list snapshot and resolves through that session's binding projections
 * outlet, so a sessions-service move lands here rather than in the sources.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import { currentSessionProjection } from '../src/client/seams/sessions.ts'

function faceOf(value: unknown): HostObservable<unknown> {
  return { getSnapshot: () => value, subscribe: () => () => {} }
}

/** A stub sessions service whose selection and bindings can move. */
function sessionsOf(initial: { current?: string; bindings: Record<string, HostObservable<unknown>> }) {
  let current = initial.current
  const listeners = new Set<() => void>()
  const requestedKeys: string[] = []
  const service = {
    list: {
      getSnapshot: () => ({ current }),
      subscribe: (fn: () => void) => {
        listeners.add(fn)
        return () => { listeners.delete(fn) }
      },
    },
    binding: (id: string) => {
      const face = initial.bindings[id]
      return face === undefined
        ? undefined
        : { session: { projections: { faceOf: (key: string) => { requestedKeys.push(key); return face } } } }
    },
    select(next?: string): void {
      current = next
      for (const fn of [...listeners]) fn()
    },
  }
  return { sessions: service as unknown as ISessions & { select(next?: string): void }, requestedKeys }
}

describe('currentSessionProjection', () => {
  it('resolves the selected binding face for the requested key', () => {
    const billing = faceOf({ cost: 1 })
    const { sessions, requestedKeys } = sessionsOf({ current: 'a', bindings: { a: billing } })
    const projection = currentSessionProjection(sessions)

    expect(projection.face('billing')).toBe(billing)
    expect(requestedKeys).toEqual(['billing'])
  })

  it('reports no face without a selection or without a materialized binding', () => {
    const { sessions } = sessionsOf({ bindings: { a: faceOf(null) } })
    const projection = currentSessionProjection(sessions)

    expect(projection.face('billing')).toBeUndefined()
    sessions.select('missing')
    expect(projection.face('billing')).toBeUndefined()
  })

  it('follows selection movement through the list feed', () => {
    const first = faceOf({ cost: 1 })
    const second = faceOf({ cost: 2 })
    const { sessions } = sessionsOf({ current: 'a', bindings: { a: first, b: second } })
    const projection = currentSessionProjection(sessions)
    const listener = vi.fn()
    projection.subscribe(listener)

    sessions.select('b')
    expect(projection.face('billing')).toBe(second)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
