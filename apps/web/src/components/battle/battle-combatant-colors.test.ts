import { describe, expect, it } from 'vitest'

import { BATTLE_COMBATANT_ACCENTS, pvpParticipantAccent } from './battle-combatant-colors'

const RESERVED_SEMANTIC_HUES = new Set(['#ff766f', '#59d39b', '#6c91c6'])

describe('battle combatant identity accents', () => {
  it('keeps opposing teams in distinct non-semantic identity families', () => {
    expect(pvpParticipantAccent(0, 0, 2)).toBe('#d0aa62')
    expect(pvpParticipantAccent(1, 0, 2)).toBe('#aa86cf')
    expect(pvpParticipantAccent(0, 1, 2)).toBe('#e0bd79')
    expect(pvpParticipantAccent(1, 1, 2)).toBe('#c09bdd')
  })

  it('keeps a third team in its own identity family', () => {
    expect(pvpParticipantAccent(2, 0, 3)).toBe('#b9aa92')
    expect(pvpParticipantAccent(2, 2, 3)).toBe('#9c8a74')
  })

  it('reserves red, green, and blue semantic colors for combat meaning', () => {
    expect(BATTLE_COMBATANT_ACCENTS).toHaveLength(6)
    expect(new Set(BATTLE_COMBATANT_ACCENTS).size).toBe(6)
    for (const accent of BATTLE_COMBATANT_ACCENTS) {
      expect(RESERVED_SEMANTIC_HUES.has(accent)).toBe(false)
    }
  })
})
