import { afterEach, describe, expect, it, vi } from 'vitest'

import { registerBattleTabCyclePrevention } from './battle-tab-cycle-prevention'

function keyEvent(code: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return Object.assign(new Event('keydown', { cancelable: true }), {
    code,
    key: code,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...modifiers,
  }) as KeyboardEvent
}

describe('battle Tab cycle prevention', () => {
  it.each([false, true])('blocks Tab with shift=%s before another command listener', (shiftKey) => {
    const target = new EventTarget()
    const cleanup = registerBattleTabCyclePrevention(target)
    const observed: string[] = []
    target.addEventListener('keydown', (event) => observed.push((event as KeyboardEvent).code))
    const tab = keyEvent('Tab', { shiftKey })
    expect(target.dispatchEvent(tab)).toBe(false)
    expect(tab.defaultPrevented).toBe(true)
    expect(observed).toEqual([])
    cleanup()
  })

  it.each(['ctrlKey', 'altKey', 'metaKey'] as const)(
    'preserves browser Tab shortcuts with %s',
    (modifier) => {
      const target = new EventTarget()
      const cleanup = registerBattleTabCyclePrevention(target)
      const tab = keyEvent('Tab', { [modifier]: true })
      expect(target.dispatchEvent(tab)).toBe(true)
      expect(tab.defaultPrevented).toBe(false)
      cleanup()
    },
  )

  it('leaves combat hotkeys, text input and Escape available', () => {
    const target = new EventTarget()
    const cleanup = registerBattleTabCyclePrevention(target)
    const observed: string[] = []
    target.addEventListener('keydown', (event) => observed.push((event as KeyboardEvent).code))
    for (const code of ['Digit1', 'KeyW', 'KeyA', 'Enter', 'Escape', 'Space']) {
      expect(target.dispatchEvent(keyEvent(code))).toBe(true)
    }
    expect(observed).toEqual(['Digit1', 'KeyW', 'KeyA', 'Enter', 'Escape', 'Space'])
    cleanup()
  })

  it('restores normal Tab behavior after the battle unmounts', () => {
    const target = new EventTarget()
    const cleanup = registerBattleTabCyclePrevention(target)
    cleanup()
    const observed: string[] = []
    target.addEventListener('keydown', (event) => observed.push((event as KeyboardEvent).code))
    const tab = keyEvent('Tab')
    expect(target.dispatchEvent(tab)).toBe(true)
    expect(tab.defaultPrevented).toBe(false)
    expect(observed).toEqual(['Tab'])
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('Escape reader focus ownership', () => {
  function fixture(contextual: boolean) {
    let readerOpen = true
    let frame: FrameRequestCallback | undefined
    class FocusedTrigger {
      isContentEditable = false
      closest(selector: string) {
        if (selector.includes('input, textarea')) return null
        if (selector === '[data-battle-preview-reader]:not([hidden])')
          return contextual ? this : null
        return selector.includes('main[data-battle-concept') ? this : null
      }
      matches(selector: string) {
        return selector === '[data-battle-info-trigger]'
      }
    }
    vi.stubGlobal('HTMLElement', FocusedTrigger)
    const root = { focus: vi.fn() }
    const doc = {
      activeElement: new FocusedTrigger(),
      defaultView: {
        requestAnimationFrame: (callback: FrameRequestCallback) => {
          frame = callback
          return 1
        },
        cancelAnimationFrame: vi.fn(),
      },
      querySelector: (selector: string) =>
        selector.includes('main[data-battle-keyboard-focus-root')
          ? root
          : selector.includes('[data-battle-info-panel]') && readerOpen
            ? {}
            : null,
    } as unknown as Document
    const target = new EventTarget()
    const cleanup = registerBattleTabCyclePrevention(target, doc)
    return {
      root,
      target,
      cleanup,
      closeReader: () => {
        readerOpen = false
      },
      flush: () => frame?.(0),
    }
  }

  it('preserves the contextual trigger after reader dismissal and releases it on a second Escape', () => {
    const f = fixture(true)
    f.target.dispatchEvent(keyEvent('Escape'))
    f.closeReader()
    f.flush()
    expect(f.root.focus).not.toHaveBeenCalled()
    f.target.dispatchEvent(keyEvent('Escape'))
    f.flush()
    expect(f.root.focus).toHaveBeenCalledOnce()
    f.cleanup()
  })

  it('retains desktop dormant-control release after a reader closes', () => {
    const f = fixture(false)
    f.target.dispatchEvent(keyEvent('Escape'))
    f.closeReader()
    f.flush()
    expect(f.root.focus).toHaveBeenCalledOnce()
    f.cleanup()
  })

  it('leaves focus owned by a parent reader when a nested reader closes', () => {
    const f = fixture(false)
    f.target.dispatchEvent(keyEvent('Escape'))
    f.flush()
    expect(f.root.focus).not.toHaveBeenCalled()
    f.cleanup()
  })
})
