import { describe, expect, it } from 'vitest'

import {
  DEFAULT_COMBAT_KEYBINDS,
  combatKeybindChord,
  parseCombatKeybindMap,
} from './combat-controls'

describe('combat keybind validation', () => {
  it('accepts the approved default combat bindings', () => {
    expect(parseCombatKeybindMap(DEFAULT_COMBAT_KEYBINDS)).toEqual(DEFAULT_COMBAT_KEYBINDS)
  })

  it('treats Tab and Shift+Tab as distinct chords', () => {
    expect(combatKeybindChord(DEFAULT_COMBAT_KEYBINDS.nextTarget)).toBe('Tab')
    expect(combatKeybindChord(DEFAULT_COMBAT_KEYBINDS.previousTarget)).toBe('Shift+Tab')
  })

  it('rejects conflicting bindings', () => {
    expect(
      parseCombatKeybindMap({
        ...DEFAULT_COMBAT_KEYBINDS,
        move: { ...DEFAULT_COMBAT_KEYBINDS.inspect },
      }),
    ).toBeNull()
  })

  it('rejects malformed browser keyboard codes', () => {
    expect(
      parseCombatKeybindMap({
        ...DEFAULT_COMBAT_KEYBINDS,
        move: { code: 'Key W!', shift: false },
      }),
    ).toBeNull()
  })
})
