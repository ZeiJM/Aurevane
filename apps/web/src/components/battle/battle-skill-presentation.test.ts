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

  it('never borrows Inspect artwork for unmapped or pending Phase 3 skills', () => {
    for (const actionId of PHASE_3_COMBAT_ACTION_IDS) {
      expect(battleSkillArtwork(actionId)).toBe(BATTLE_MISSING_ARTWORK)
      expect(battleSkillArtwork(actionId)).not.toBe(BATTLE_COMMAND_ARTWORK.inspect)
    }
    expect(battleSkillArtwork('future.skill')).toBe(BATTLE_MISSING_ARTWORK)
  })

  it('keeps resonance artwork resolution separate from combat actions', () => {
    for (const resonanceId of PHASE_3_RESONANCE_IDS) {
      expect(battleResonanceArtwork(resonanceId)).toBe(BATTLE_MISSING_ARTWORK)
      expect(battleResonanceArtwork(resonanceId)).not.toBe(BATTLE_COMMAND_ARTWORK.inspect)
    }
  })
})
