import { describe, expect, it } from 'vitest'

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
