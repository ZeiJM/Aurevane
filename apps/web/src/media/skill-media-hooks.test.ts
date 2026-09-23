import { describe, expect, it } from 'vitest'

import {
  isRegisteredSkillAudioCueHook,
  isRegisteredSkillIconHook,
  registeredSkillArtworkSource,
  resolveSkillAudioCueHook,
  resolveSkillIconHook,
  skillAudioCueHookOptions,
  skillIconHookOptions,
} from './skill-media-hooks'

describe('Skill media hook registry', () => {
  it('resolves approved icon hooks to real current Skill artwork', () => {
    const icon = resolveSkillIconHook('skill.lifebinder.mend.icon')
    expect(icon).toEqual(
      expect.objectContaining({
        key: 'skill.lifebinder.mend.icon',
        skillId: 'lifebinder.mend',
      }),
    )
    expect(icon?.previewSrc).toBe(
      '/media/art/discipline-skills/lifebinder-mend-v01.webp',
    )
    expect(registeredSkillArtworkSource('lifebinder.mend')).toBe(icon?.previewSrc)
    expect(registeredSkillArtworkSource('lifebinder.vital-sever')).toMatch(
      /^data:image\/svg\+xml/,
    )
    const essence = resolveSkillIconHook('essence.aetherist.aether-nova.icon')
    expect(essence).toEqual(
      expect.objectContaining({
        key: 'essence.aetherist.aether-nova.icon',
        skillId: 'essence.aetherist.aether-nova',
      }),
    )
    expect(essence?.previewSrc).toBe('/media/art/essence-skills/aetherist-aether-nova-v01.webp')
    expect(
      skillIconHookOptions.filter((option) => option.skillId.startsWith('essence.')),
    ).toHaveLength(17)
    expect(isRegisteredSkillIconHook('essence.aetherist.aether-nova.icon')).toBe(true)
    expect(skillIconHookOptions.length).toBeGreaterThan(10)
    expect(isRegisteredSkillIconHook('skill.lifebinder.mend.icon')).toBe(true)
    expect(isRegisteredSkillIconHook('skill.unknown.icon')).toBe(false)
  })

  it('keeps canonical audio hooks registered while distinguishing available runtime audio', () => {
    const ironfist = resolveSkillAudioCueHook('skill.ironfist.breakfall.audio')
    expect(ironfist).toEqual(
      expect.objectContaining({
        key: 'skill.ironfist.breakfall.audio',
        skillId: 'ironfist.breakfall',
        available: true,
        audioFamily: 'ironfist',
        sampleAssetId: 'audio.phase4.ironfist-action-v02-1',
      }),
    )
    const vanguard = resolveSkillAudioCueHook('skill.vanguard.forceful-strike.audio')
    expect(vanguard).toEqual(
      expect.objectContaining({
        skillId: 'vanguard.forceful-strike',
        available: true,
        audioFamily: 'vanguard',
        sampleAssetId: 'audio.phase4.vanguard-action-v02-1',
      }),
    )
    const foundationFamilies = ['vanguard', 'farstrider', 'shadehand', 'aetherist', 'lifebinder']
    for (const family of foundationFamilies) {
      expect(
        skillAudioCueHookOptions.some(
          (option) => option.sourceDisciplineId === family && option.available,
        ),
      ).toBe(true)
    }
    const aetherNova = resolveSkillAudioCueHook('essence.aetherist.aether-nova.audio')
    expect(aetherNova).toEqual(
      expect.objectContaining({
        available: true,
        audioFamily: 'aetherist',
        sampleAssetId: 'audio.phase4.aetherist-essence-v02-1',
      }),
    )
    expect(skillAudioCueHookOptions.length).toBeGreaterThan(10)
    expect(isRegisteredSkillAudioCueHook('skill.vanguard.forceful-strike.audio')).toBe(true)
    expect(isRegisteredSkillAudioCueHook('essence.aetherist.aether-nova.audio')).toBe(true)
    expect(isRegisteredSkillAudioCueHook('skill.unknown.audio')).toBe(false)
  })
})
