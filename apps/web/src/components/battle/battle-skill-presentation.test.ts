import {
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
} from '@aurevane/game-core/combat/pv1f-skills'
import { describe, expect, it } from 'vitest'

import {
  BATTLE_COMMAND_ARTWORK,
  BATTLE_MISSING_ARTWORK,
  PHASE_3_COMBAT_ACTION_IDS,
  PHASE_3_COMBAT_ARTWORK,
  PHASE_3_RESONANCE_ARTWORK,
  PHASE_3_RESONANCE_IDS,
  battleResonanceArtwork,
  battleSkillArtwork,
} from './battle-skill-presentation'

describe('battle skill artwork presentation', () => {
  it('preserves the established legacy command artwork', () => {
    expect(BATTLE_COMMAND_ARTWORK).toEqual({
      inspect: '/media/skills/inspect.webp',
      move: '/media/skills/move.webp',
      attack: '/media/skills/basic-attack-fist.webp',
      guard: '/media/skills/guard.webp',
      finish: '/media/skills/finish-turn.webp',
    })
    expect(battleSkillArtwork(PV1F_BASIC_ATTACK_ID)).toBe('/media/skills/basic-attack-fist.webp')
    expect(battleSkillArtwork(PV1F_GUARD_ACTION_ID)).toBe('/media/skills/guard.webp')
    expect(battleSkillArtwork(PV1F_RECOVER_ACTION_ID)).toBe('/media/skills/hp-recovery.webp')
    expect(battleSkillArtwork(PV1F_MP_RECOVER_ACTION_ID)).toBe('/media/skills/mp-recovery.svg')
  })

  it('maps every Phase 3 combat action to its own production artwork', () => {
    const resolvedArtwork = PHASE_3_COMBAT_ACTION_IDS.map((actionId) => {
      const artwork = battleSkillArtwork(actionId)
      expect(artwork).toBe(PHASE_3_COMBAT_ARTWORK[actionId])
      expect(artwork).not.toBe(BATTLE_MISSING_ARTWORK)
      expect(artwork).not.toBe(BATTLE_COMMAND_ARTWORK.inspect)
      return artwork
    })

    expect(new Set(resolvedArtwork).size).toBe(PHASE_3_COMBAT_ACTION_IDS.length)
    expect(battleSkillArtwork('future.skill')).toBe(BATTLE_MISSING_ARTWORK)
  })

  it('maps resonance presentation independently from combat actions', () => {
    for (const resonanceId of PHASE_3_RESONANCE_IDS) {
      const artwork = battleResonanceArtwork(resonanceId)
      expect(artwork).toBe(PHASE_3_RESONANCE_ARTWORK[resonanceId])
      expect(artwork).not.toBe(BATTLE_MISSING_ARTWORK)
      expect(artwork).not.toBe(BATTLE_COMMAND_ARTWORK.inspect)
    }
    expect(battleResonanceArtwork('future.resonance')).toBe(BATTLE_MISSING_ARTWORK)
  })
})
