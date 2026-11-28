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
  it('uses the painted command artwork for each established command', () => {
    expect(BATTLE_COMMAND_ARTWORK).toEqual({
      inspect: '/media/skills/inspect-anime-v01.webp',
      move: '/media/skills/move-anime-v01.webp',
      attack: '/media/skills/basic-attack-fist-anime-v01.webp',
      guard: '/media/skills/guard-anime-v01.webp',
      finish: '/media/skills/finish-turn-anime-v01.webp',
    })
    expect(battleSkillArtwork(PV1F_BASIC_ATTACK_ID)).toBe(
      '/media/skills/basic-attack-fist-anime-v01.webp',
    )
    expect(battleSkillArtwork(PV1F_GUARD_ACTION_ID)).toBe('/media/skills/guard-anime-v01.webp')
    expect(battleSkillArtwork(PV1F_RECOVER_ACTION_ID)).toBe(
      '/media/skills/hp-recovery-anime-v01.webp',
    )
    expect(battleSkillArtwork(PV1F_MP_RECOVER_ACTION_ID)).toBe(
      '/media/skills/mp-recovery-dark-fantasy-anime-v01.webp',
    )
  })

  it('lets a published Skill media hook replace artwork without changing the action id', () => {
    const hooked = battleSkillArtwork('vanguard.forceful-strike', 'skill.lifebinder.mend.icon')
    expect(hooked).toBe(battleSkillArtwork('lifebinder.mend'))
    expect(hooked).toBe('/media/art/discipline-skills/lifebinder-mend-anime-v01.webp')
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
      '/media/art/discipline-skills/lifebinder-vital-sever-anime-v01.webp',
      '/media/art/discipline-skills/lifebinder-searing-bloom-anime-v01.webp',
      '/media/art/essence-skills/lifebinder-verdant-rupture-anime-v01.webp',
    ])
    expect(battleSkillArtwork('future.skill')).toBe(BATTLE_MISSING_ARTWORK)
  })

  it('uses approved static art without disturbing unreplaced generated Skill artwork', () => {
    expect(battleSkillArtwork('lifebinder.mend')).toBe(
      '/media/art/discipline-skills/lifebinder-mend-anime-v01.webp',
    )
    expect(battleSkillArtwork('lifebinder.renew')).toBe(
      '/media/art/discipline-skills/lifebinder-renew-anime-v01.webp',
    )
    expect(battleSkillArtwork('ironfist.rising-fist')).toBe(
      '/media/art/discipline-skills/ironfist-rising-fist-anime-v01.webp',
    )
    expect(battleSkillArtwork('ironfist.last-stand')).toBe(
      '/media/art/discipline-skills/ironfist-last-stand-anime-v01.webp',
    )
    expect(battleSkillArtwork('aetherist.arc-bolt')).toBe(
      '/media/art/discipline-skills/aetherist-arc-bolt-anime-v01.webp',
    )
    expect(battleSkillArtwork('aetherist.overchannel')).toBe(
      '/media/art/discipline-skills/aetherist-overchannel-anime-v01.webp',
    )
    expect(battleSkillArtwork('chronist.temporal-bolt')).toBe(
      '/media/art/discipline-skills/chronist-temporal-bolt-anime-v01.webp',
    )
    expect(battleSkillArtwork('chronist.stolen-moment')).toBe(
      '/media/art/discipline-skills/chronist-stolen-moment-anime-v01.webp',
    )
    expect(battleSkillArtwork('bastion.shield-bash')).toBe(
      '/media/art/discipline-skills/bastion-shield-bash-anime-v01.webp',
    )
    expect(battleSkillArtwork('bastion.steady-footing')).toBe(
      '/media/art/discipline-skills/bastion-steady-footing-anime-v01.webp',
    )
    expect(battleSkillArtwork('ravager.frenzy')).toBe(
      '/media/art/discipline-skills/ravager-frenzy-anime-v01.webp',
    )
    expect(battleSkillArtwork('edgedancer.lunge')).toBe(
      '/media/art/discipline-skills/edgedancer-lunge-anime-v01.webp',
    )
    expect(battleSkillArtwork('edgedancer.finishing-thrust')).toBe(
      '/media/art/discipline-skills/edgedancer-finishing-thrust-anime-v01.webp',
    )
    expect(battleSkillArtwork('wildwarden.snare')).toBe(
      '/media/art/discipline-skills/wildwarden-snare-anime-v01.webp',
    )
    expect(battleSkillArtwork('wildwarden.close-quarry')).toBe(
      '/media/art/discipline-skills/wildwarden-close-quarry-anime-v01.webp',
    )

    expect(battleSkillArtwork('runeblade.aether-cut')).toBe(
      '/media/art/discipline-skills/runeblade-aether-cut-anime-v01.webp',
    )
    expect(battleSkillArtwork('runeblade.rune-mending')).toBe(
      '/media/art/discipline-skills/runeblade-rune-mending-anime-v01.webp',
    )

    expect(battleSkillArtwork('dawnshield.radiant-strike')).toBe(
      '/media/art/discipline-skills/dawnshield-radiant-strike-anime-v01.webp',
    )
    expect(battleSkillArtwork('dawnshield.last-light')).toBe(
      '/media/art/discipline-skills/dawnshield-last-light-anime-v01.webp',
    )
    expect(battleSkillArtwork('cinderweaver.cinder-bolt')).toBe(
      '/media/art/discipline-skills/cinderweaver-cinder-bolt-anime-v01.webp',
    )
    expect(battleSkillArtwork('cinderweaver.blistering-heat')).toBe(
      '/media/art/discipline-skills/cinderweaver-blistering-heat-anime-v01.webp',
    )
    expect(battleSkillArtwork('frostweaver.ice-lance')).toBe(
      '/media/art/discipline-skills/frostweaver-ice-lance-anime-v01.webp',
    )
    expect(battleSkillArtwork('frostweaver.brittle-ice')).toBe(
      '/media/art/discipline-skills/frostweaver-brittle-ice-anime-v01.webp',
    )
    expect(battleSkillArtwork('stormsinger.arc-spark')).toBe(
      '/media/art/discipline-skills/stormsinger-arc-spark-anime-v01.webp',
    )
    expect(battleSkillArtwork('stormsinger.storm-breath')).toBe(
      '/media/art/discipline-skills/stormsinger-storm-breath-anime-v01.webp',
    )
    expect(battleSkillArtwork('tidecaller.water-lance')).toBe(
      '/media/art/discipline-skills/tidecaller-water-lance-anime-v01.webp',
    )
    expect(battleSkillArtwork('tidecaller.crushing-wave')).toBe(
      '/media/art/discipline-skills/tidecaller-crushing-wave-anime-v01.webp',
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
        '/media/art/resonances/resonance-lifebinder-vanguard-mercys-edge-anime-v01.webp',
      )
      expect(existsSync(new URL(`../../../public${artwork}`, import.meta.url))).toBe(true)
    }

    const expandedResonance = battleResonanceArtwork('resonance.aetherist-farstrider.arcane-hunt')
    expect(expandedResonance).toBe(
      '/media/art/resonances/resonance-aetherist-farstrider-arcane-hunt-anime-v01.webp',
    )
    expect(existsSync(new URL(`../../../public${expandedResonance}`, import.meta.url))).toBe(true)

    const completedResonance = battleResonanceArtwork(
      'resonance.frostweaver-runeblade.linked-sequence',
    )
    expect(completedResonance).toBe(
      '/media/art/resonances/resonance-frostweaver-runeblade-frozen-sigil-anime-v01.webp',
    )
    expect(existsSync(new URL(`../../../public${completedResonance}`, import.meta.url))).toBe(true)

    const finalResonance = battleResonanceArtwork('resonance.chronist-tidecaller.linked-sequence')
    expect(finalResonance).toBe(
      '/media/art/resonances/resonance-chronist-tidecaller-measured-tide-anime-v01.webp',
    )
    expect(existsSync(new URL(`../../../public${finalResonance}`, import.meta.url))).toBe(true)

    expect(battleResonanceArtwork('future.resonance')).toBe(BATTLE_MISSING_ARTWORK)
  })
})
it('resolves exact finalized artwork identity through the gated immutable media reader', () => {
  const id = '00000000-0000-4000-8000-000000000012'
  expect(battleSkillArtwork('basic.recover.mp', `content-media.${id}`)).toBe(
    `/api/content-media/${id}`,
  )
  expect(battleSkillArtwork('basic.recover.mp', 'content-media.https://evil.test')).toBe(
    '/media/skills/mp-recovery-dark-fantasy-anime-v01.webp',
  )
})
