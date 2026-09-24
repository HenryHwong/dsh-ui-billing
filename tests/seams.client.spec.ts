/**
 * The displayed-session projection seam: the session area adapter's current
 * binding owns the displayed id and resolves the requested projection face, so
 * a session-area move lands here rather than in the sources.
 */
import { describe, expect, it, vi } from 'vitest'
import type { UiSession } from '@deepseek-ai/dsh-client-ui-session/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import { currentSessionProjection } from '../src/client/seams/sessions.ts'

function faceOf(value: unknown): HostObservable<unknown> {
  return { getSnapshot: () => value, subscribe: () => () => {} }
}

/** A stub session area adapter whose displayed session and faces can move. */
function uiSessionOf(initial: { key?: string; faces?: Record<string, HostObservable<unknown>> }) {
  let key = initial.key
  let faces = initial.faces ?? {}
  const listeners = new Set<() => void>()
  const requestedKeys: string[] = []
  const binding = () => ({
    key,
    hooks: {},
    keyedHooks: {
      projection: key === undefined
        ? undefined
        : (requested: string) => {
          requestedKeys.push(requested)
          return faces[requested]
        },
    },
    props: {},
  })
  const current = {
    getSnapshot: binding,
    subscribe: (fn: () => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
  return {
    uiSession: { adapter: { current } } as unknown as UiSession,
    requestedKeys,
    display(next?: string, nextFaces?: Record<string, HostObservable<unknown>>): void {
      key = next
      faces = nextFaces ?? {}
      for (const fn of [...listeners]) fn()
    },
  }
}

describe('currentSessionProjection', () => {
  it('resolves the displayed binding face for the requested key', () => {
    const billing = faceOf({ cost: 1 })
    const { uiSession, requestedKeys } = uiSessionOf({ key: 'a', faces: { billing } })
    const projection = currentSessionProjection(uiSession)

    expect(projection.face('billing')).toBe(billing)
    expect(requestedKeys).toEqual(['billing'])
  })

  it('reports no face without a displayed session', () => {
    const { uiSession, display } = uiSessionOf({ faces: { billing: faceOf(null) } })
    const projection = currentSessionProjection(uiSession)

    expect(projection.face('billing')).toBeUndefined()
    display('a')
    expect(projection.face('billing')).toBeUndefined()
  })

  it('follows display movement through the binding feed', () => {
    const first = faceOf({ cost: 1 })
    const second = faceOf({ cost: 2 })
    const { uiSession, display } = uiSessionOf({ key: 'a', faces: { billing: first } })
    const projection = currentSessionProjection(uiSession)
    const listener = vi.fn()
    projection.subscribe(listener)

    expect(projection.face('billing')).toBe(first)
    display('b', { billing: second })
    expect(projection.face('billing')).toBe(second)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
