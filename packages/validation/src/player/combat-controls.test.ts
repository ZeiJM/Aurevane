import { describe, expect, it } from 'vitest'

import {
  DEFAULT_COMBAT_KEYBINDS,
  combatKeybindChord,
  parseCombatKeybindMap,
} from './combat-controls'

describe('combat keybind validation', () => {
  it('uses the accepted cockpit order and four independent Skill hotkeys', () => {
    const bindings = DEFAULT_COMBAT_KEYBINDS as Record<string, { code: string; shift: boolean }>
    expect(
      [
        'move',
        'basicAttack',
        'guard',
        'skill1',
        'skill2',
        'skill3',
        'skill4',
        'essence',
        'supernatural',
      ].map((key) => bindings[key]?.code),
    ).toEqual([
      'Digit1',
      'Digit2',
      'Digit3',
      'Digit4',
      'Digit5',
      'Digit6',
      'Digit7',
      'Digit8',
      'Digit9',
    ])
    expect(bindings.inspect?.code).toBe('KeyI')
    expect(bindings.recover?.code).toBe('KeyR')
  })

  it('upgrades old default slots and preserves deliberately customized legacy controls', () => {
    const legacy = {
      inspect: { code: 'Digit1', shift: false },
      move: { code: 'Digit2', shift: false },
      basicAttack: { code: 'Digit3', shift: false },
      guard: { code: 'Digit4', shift: false },
      recover: { code: 'Digit5', shift: false },
      endTurn: { code: 'Space', shift: false },
      confirm: { code: 'Enter', shift: false },
      cancel: { code: 'Escape', shift: false },
      faceNorth: { code: 'KeyW', shift: false },
      faceWest: { code: 'KeyA', shift: false },
      faceSouth: { code: 'KeyS', shift: false },
      faceEast: { code: 'KeyD', shift: false },
      nextTarget: { code: 'Tab', shift: false },
      previousTarget: { code: 'Tab', shift: true },
      combatLog: { code: 'KeyL', shift: false },
    }
    expect(parseCombatKeybindMap(legacy)).toEqual(DEFAULT_COMBAT_KEYBINDS)
    const custom = parseCombatKeybindMap({
      ...legacy,
      guard: { code: 'Digit8', shift: false },
    }) as Record<string, { code: string; shift: boolean }> | null
    expect(custom?.guard).toEqual({ code: 'Digit8', shift: false })
    expect(custom?.essence).toEqual({ code: 'Digit8', shift: true })
  })
  it.each([
    ['guard', 'KeyI'],
    ['move', 'KeyR'],
  ])('preserves custom %s when an upgraded default wants its chord', (action, code) => {
    const legacy = Object.fromEntries(
      Object.entries(DEFAULT_COMBAT_KEYBINDS).filter(
        ([key]) =>
          !['skill1', 'skill2', 'skill3', 'skill4', 'essence', 'supernatural'].includes(key),
      ),
    )
    for (const [key, digit] of [
      ['inspect', 1],
      ['move', 2],
      ['basicAttack', 3],
      ['guard', 4],
      ['recover', 5],
    ] as const)
      legacy[key] = { code: `Digit${digit}`, shift: false }
    legacy[action!] = { code: code!, shift: false }
    const result = parseCombatKeybindMap(legacy)
    expect(result).not.toBeNull()
    expect(result?.[action as keyof typeof DEFAULT_COMBAT_KEYBINDS]).toEqual({ code, shift: false })
    expect(new Set(Object.values(result!).map(combatKeybindChord)).size).toBe(
      Object.keys(result!).length,
    )
  })

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
