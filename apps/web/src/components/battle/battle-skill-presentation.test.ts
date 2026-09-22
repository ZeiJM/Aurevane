import {
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
} from '@aurevane/game-core/combat/pv1f-skills'
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'

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

  it('lets a published Skill media hook replace artwork without changing the action id', () => {
    const hooked = battleSkillArtwork('vanguard.forceful-strike', 'skill.lifebinder.mend.icon')
    expect(hooked).toBe(battleSkillArtwork('lifebinder.mend'))
    expect(hooked).toMatch(/^data:image\/svg\+xml,/)
    expect(decodeURIComponent(hooked)).toContain('data-art-kind="discipline-skill-action"')
    expect(decodeURIComponent(hooked)).toContain('data-action-figure="true"')
    expect(battleSkillArtwork('vanguard.forceful-strike', 'skill.unknown.icon')).toBe(
      PHASE_3_COMBAT_ARTWORK['vanguard.forceful-strike'],
    )
  })

  it('gives every Phase 3 action distinct generated dark-fantasy art', () => {
    const resolvedArtwork = PHASE_3_COMBAT_ACTION_IDS.map((actionId) => {
      const artwork = battleSkillArtwork(actionId)
      expect(artwork).toBe(PHASE_3_COMBAT_ARTWORK[actionId])
      expect(artwork).not.toBe(BATTLE_MISSING_ARTWORK)
      expect(artwork).not.toBe(BATTLE_COMMAND_ARTWORK.inspect)
      if (artwork.startsWith('/media/')) {
        expect(existsSync(new URL(`../../../public${artwork}`, import.meta.url))).toBe(true)
      } else {
        expect(artwork.startsWith('data:image/svg+xml,')).toBe(true)
      }
      return artwork
    })

    expect(new Set(resolvedArtwork).size).toBe(PHASE_3_COMBAT_ACTION_IDS.length)
    const lifebinderArtwork = GENERATED_LIFEBINDER_IDS.map((actionId) =>
      battleSkillArtwork(actionId),
    )
    expect(new Set(lifebinderArtwork).size).toBe(GENERATED_LIFEBINDER_IDS.length)
    expect(lifebinderArtwork.slice(0, 2).every((source) => source.startsWith('data:image/svg+xml,'))).toBe(
      true,
    )
    expect(lifebinderArtwork[2]).toBe(
      '/media/art/essence-skills/lifebinder-verdant-rupture-v01.webp',
    )
    expect(battleSkillArtwork('future.skill')).toBe(BATTLE_MISSING_ARTWORK)
  })

  it('replaces the four former painted exceptions with distinct comprehensive-suite artwork', () => {
    const ids = [
      'runeblade.aether-cut',
      'runeblade.sigil-brand',
      'lifebinder.mend',
      'lifebinder.renew',
    ]
    const artwork = ids.map((id) => battleSkillArtwork(id))
    expect(new Set(artwork).size).toBe(ids.length)
    for (const source of artwork) {
      expect(source).toMatch(/^data:image\/svg\+xml,/)
      const svg = decodeURIComponent(source)
      expect(svg).toContain('width="512"')
      expect(svg).toContain('height="512"')
      expect(svg).toContain('data-art-kind="discipline-skill-action"')
      expect(svg).toContain('data-action-figure="true"')
    }
  })

  it('gives the Foundation trio Techniques and Essences non-missing artwork', () => {
    for (const skillId of FOUNDATION_TRIO_SAMPLE_IDS) {
      const artwork = battleSkillArtwork(skillId)
      expect(artwork).not.toBe(BATTLE_MISSING_ARTWORK)
      if (skillId.startsWith('essence.')) {
        expect(artwork).toMatch(/^\/media\/art\/essence-skills\/.+-v01\.webp$/)
        expect(existsSync(new URL(`../../../public${artwork}`, import.meta.url))).toBe(true)
      } else {
        expect(artwork.startsWith('data:image/svg+xml,')).toBe(true)
      }
    }
  })

  it('maps established and expanded resonance presentation independently from combat actions', () => {
    for (const resonanceId of PHASE_3_RESONANCE_IDS) {
      const artwork = battleResonanceArtwork(resonanceId)
      expect(artwork).toBe(PHASE_3_RESONANCE_ARTWORK[resonanceId])
      expect(artwork).not.toBe(BATTLE_MISSING_ARTWORK)
      expect(artwork).not.toBe(BATTLE_COMMAND_ARTWORK.inspect)
      expect(artwork.startsWith('data:image/svg+xml,')).toBe(true)
    }

    const expandedResonance = battleResonanceArtwork('resonance.aetherist-farstrider.arcane-hunt')
    expect(expandedResonance).not.toBe(BATTLE_MISSING_ARTWORK)
    expect(expandedResonance.startsWith('data:image/svg+xml,')).toBe(true)
    expect(battleResonanceArtwork('future.resonance')).toBe(BATTLE_MISSING_ARTWORK)
  })
})
