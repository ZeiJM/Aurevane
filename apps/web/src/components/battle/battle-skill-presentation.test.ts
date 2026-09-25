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

const LIFEBINDER_SAMPLE_IDS = [
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
    expect(hooked).toBe('/media/art/discipline-skills/lifebinder-mend-v01.webp')
    expect(existsSync(new URL(`../../../public${hooked}`, import.meta.url))).toBe(true)
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
    const lifebinderArtwork = LIFEBINDER_SAMPLE_IDS.map((actionId) => battleSkillArtwork(actionId))
    expect(new Set(lifebinderArtwork).size).toBe(LIFEBINDER_SAMPLE_IDS.length)
    expect(lifebinderArtwork).toEqual([
      '/media/art/discipline-skills/lifebinder-vital-sever-v01.webp',
      '/media/art/discipline-skills/lifebinder-searing-bloom-v01.webp',
      '/media/art/essence-skills/lifebinder-verdant-rupture-v01.webp',
    ])
    expect(battleSkillArtwork('future.skill')).toBe(BATTLE_MISSING_ARTWORK)
  })

  it('uses approved static art without disturbing unreplaced generated Skill artwork', () => {
    expect(battleSkillArtwork('lifebinder.mend')).toBe(
      '/media/art/discipline-skills/lifebinder-mend-v01.webp',
    )
    expect(battleSkillArtwork('lifebinder.renew')).toBe(
      '/media/art/discipline-skills/lifebinder-renew-v01.webp',
    )
    expect(battleSkillArtwork('ironfist.rising-fist')).toBe(
      '/media/art/discipline-skills/ironfist-rising-fist-v01.webp',
    )
    expect(battleSkillArtwork('ironfist.last-stand')).toBe(
      '/media/art/discipline-skills/ironfist-last-stand-v01.webp',
    )
    expect(battleSkillArtwork('aetherist.arc-bolt')).toBe(
      '/media/art/discipline-skills/aetherist-arc-bolt-v01.webp',
    )
    expect(battleSkillArtwork('aetherist.overchannel')).toBe(
      '/media/art/discipline-skills/aetherist-overchannel-v01.webp',
    )
    expect(battleSkillArtwork('chronist.temporal-bolt')).toBe(
      '/media/art/discipline-skills/chronist-temporal-bolt-v01.webp',
    )
    expect(battleSkillArtwork('chronist.stolen-moment')).toBe(
      '/media/art/discipline-skills/chronist-stolen-moment-v01.webp',
    )
    expect(battleSkillArtwork('bastion.shield-bash')).toBe(
      '/media/art/discipline-skills/bastion-shield-bash-v02.webp',
    )
    expect(battleSkillArtwork('bastion.steady-footing')).toBe(
      '/media/art/discipline-skills/bastion-steady-footing-v02.webp',
    )
    expect(battleSkillArtwork('ravager.frenzy')).toBe(
      '/media/art/discipline-skills/ravager-frenzy-v01.webp',
    )
    expect(battleSkillArtwork('edgedancer.lunge')).toBe(
      '/media/art/discipline-skills/edgedancer-lunge-v01.webp',
    )
    expect(battleSkillArtwork('edgedancer.finishing-thrust')).toBe(
      '/media/art/discipline-skills/edgedancer-finishing-thrust-v01.webp',
    )
    expect(battleSkillArtwork('wildwarden.snare')).toBe(
      '/media/art/discipline-skills/wildwarden-snare-v01.webp',
    )
    expect(battleSkillArtwork('wildwarden.close-quarry')).toBe(
      '/media/art/discipline-skills/wildwarden-close-quarry-v01.webp',
    )

    expect(battleSkillArtwork('runeblade.aether-cut')).toBe(
      '/media/art/discipline-skills/runeblade-aether-cut-v01.webp',
    )
    expect(battleSkillArtwork('runeblade.rune-mending')).toBe(
      '/media/art/discipline-skills/runeblade-rune-mending-v01.webp',
    )

    expect(battleSkillArtwork('dawnshield.radiant-strike')).toBe(
      '/media/art/discipline-skills/dawnshield-radiant-strike-v01.webp',
    )
    expect(battleSkillArtwork('dawnshield.last-light')).toBe(
      '/media/art/discipline-skills/dawnshield-last-light-v01.webp',
    )
    expect(battleSkillArtwork('cinderweaver.cinder-bolt')).toBe(
      '/media/art/discipline-skills/cinderweaver-cinder-bolt-v01.webp',
    )
    expect(battleSkillArtwork('cinderweaver.blistering-heat')).toBe(
      '/media/art/discipline-skills/cinderweaver-blistering-heat-v01.webp',
    )
    expect(battleSkillArtwork('frostweaver.ice-lance')).toBe(
      '/media/art/discipline-skills/frostweaver-ice-lance-v01.webp',
    )
    expect(battleSkillArtwork('frostweaver.brittle-ice')).toBe(
      '/media/art/discipline-skills/frostweaver-brittle-ice-v01.webp',
    )
    expect(battleSkillArtwork('stormsinger.arc-spark')).toBe(
      '/media/art/discipline-skills/stormsinger-arc-spark-v01.webp',
    )
    expect(battleSkillArtwork('stormsinger.storm-breath')).toBe(
      '/media/art/discipline-skills/stormsinger-storm-breath-v01.webp',
    )
    expect(battleSkillArtwork('tidecaller.water-lance')).toBe(
      '/media/art/discipline-skills/tidecaller-water-lance-v01.webp',
    )
    expect(battleSkillArtwork('tidecaller.crushing-wave')).toBe(
      '/media/art/discipline-skills/tidecaller-crushing-wave-v01.webp',
    )
  })

  it('gives the Foundation trio Techniques and Essences non-missing artwork', () => {
    for (const skillId of FOUNDATION_TRIO_SAMPLE_IDS) {
      const artwork = battleSkillArtwork(skillId)
      expect(artwork).not.toBe(BATTLE_MISSING_ARTWORK)
      if (skillId.startsWith('essence.')) {
        expect(artwork).toMatch(/^\/media\/art\/essence-skills\/.+-v01\.webp$/)
      } else if (
        skillId.startsWith('aetherist.') ||
        skillId.startsWith('farstrider.') ||
        skillId.startsWith('shadehand.')
      ) {
        expect(artwork).toMatch(/^\/media\/art\/discipline-skills\/.+-v01\.webp$/)
      } else {
        expect(artwork.startsWith('data:image/svg+xml,')).toBe(true)
      }
      if (artwork.startsWith('/media/')) {
        expect(existsSync(new URL(`../../../public${artwork}`, import.meta.url))).toBe(true)
      }
    }
  })

  it('uses approved Resonance art for the complete authored catalog', () => {
    for (const resonanceId of PHASE_3_RESONANCE_IDS) {
      const artwork = battleResonanceArtwork(resonanceId)
      expect(artwork).toBe(PHASE_3_RESONANCE_ARTWORK[resonanceId])
      expect(artwork).toBe(
        '/media/art/resonances/resonance-lifebinder-vanguard-mercys-edge-v01.webp',
      )
      expect(existsSync(new URL(`../../../public${artwork}`, import.meta.url))).toBe(true)
    }

    const expandedResonance = battleResonanceArtwork('resonance.aetherist-farstrider.arcane-hunt')
    expect(expandedResonance).toBe(
      '/media/art/resonances/resonance-aetherist-farstrider-arcane-hunt-v01.webp',
    )
    expect(existsSync(new URL(`../../../public${expandedResonance}`, import.meta.url))).toBe(true)

    const completedResonance = battleResonanceArtwork(
      'resonance.frostweaver-runeblade.linked-sequence',
    )
    expect(completedResonance).toBe(
      '/media/art/resonances/resonance-frostweaver-runeblade-frozen-sigil-v01.webp',
    )
    expect(existsSync(new URL(`../../../public${completedResonance}`, import.meta.url))).toBe(true)

    const finalResonance = battleResonanceArtwork('resonance.chronist-tidecaller.linked-sequence')
    expect(finalResonance).toBe(
      '/media/art/resonances/resonance-chronist-tidecaller-measured-tide-v01.webp',
    )
    expect(existsSync(new URL(`../../../public${finalResonance}`, import.meta.url))).toBe(true)

    expect(battleResonanceArtwork('future.resonance')).toBe(BATTLE_MISSING_ARTWORK)
  })
})
