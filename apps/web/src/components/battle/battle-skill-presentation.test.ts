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

const GENERATED_LIFEBINDER_IDS = [
  'lifebinder.vital-sever',
  'lifebinder.searing-bloom',
  'essence.lifebinder.verdant-rupture',
] as const

const FOUNDATION_TRIO_SAMPLE_IDS = [
  'aetherist.arc-bolt',
  'aetherist.overchannel',
  'farstrider.aimed-shot',
  'farstrider.longshot',
  'shadehand.backstab',
  'shadehand.execution-cut',
  'essence.aetherist.aether-nova',
  'essence.farstrider.deadeye-barrage',
  'essence.shadehand.perfect-opening',
] as const

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

  it('keeps established Phase 3 artwork and gives newly authored Lifebinder actions distinct art', () => {
    const generatedIds = new Set<string>(GENERATED_LIFEBINDER_IDS)
    const resolvedArtwork = PHASE_3_COMBAT_ACTION_IDS.map((actionId) => {
      const artwork = battleSkillArtwork(actionId)
      if (!generatedIds.has(actionId)) {
        expect(artwork).toBe(PHASE_3_COMBAT_ARTWORK[actionId])
      }
      expect(artwork).not.toBe(BATTLE_MISSING_ARTWORK)
      expect(artwork).not.toBe(BATTLE_COMMAND_ARTWORK.inspect)
      return artwork
    })

    expect(new Set(resolvedArtwork).size).toBe(PHASE_3_COMBAT_ACTION_IDS.length)
    const lifebinderArtwork = GENERATED_LIFEBINDER_IDS.map((actionId) =>
      battleSkillArtwork(actionId),
    )
    expect(new Set(lifebinderArtwork).size).toBe(GENERATED_LIFEBINDER_IDS.length)
    expect(lifebinderArtwork.every((source) => source.startsWith('data:image/svg+xml,'))).toBe(true)
    expect(battleSkillArtwork('future.skill')).toBe(BATTLE_MISSING_ARTWORK)
  })

  it('gives the Foundation trio Techniques and Essences non-missing generated artwork', () => {
    for (const skillId of FOUNDATION_TRIO_SAMPLE_IDS) {
      const artwork = battleSkillArtwork(skillId)
      expect(artwork).not.toBe(BATTLE_MISSING_ARTWORK)
      expect(artwork.startsWith('data:image/svg+xml,')).toBe(true)
    }
  })

  it('maps established and expanded resonance presentation independently from combat actions', () => {
    for (const resonanceId of PHASE_3_RESONANCE_IDS) {
      const artwork = battleResonanceArtwork(resonanceId)
      expect(artwork).toBe(PHASE_3_RESONANCE_ARTWORK[resonanceId])
      expect(artwork).not.toBe(BATTLE_MISSING_ARTWORK)
      expect(artwork).not.toBe(BATTLE_COMMAND_ARTWORK.inspect)
    }

    const expandedResonance = battleResonanceArtwork(
      'resonance.aetherist-farstrider.arcane-hunt',
    )
    expect(expandedResonance).not.toBe(BATTLE_MISSING_ARTWORK)
    expect(expandedResonance.startsWith('data:image/svg+xml,')).toBe(true)
    expect(battleResonanceArtwork('future.resonance')).toBe(BATTLE_MISSING_ARTWORK)
  })
})
