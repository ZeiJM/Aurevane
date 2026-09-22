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
    expect(icon?.previewSrc).toMatch(/^data:image\/svg\+xml,/)
    expect(decodeURIComponent(icon!.previewSrc)).toContain(
      'data-art-kind="discipline-skill-action"',
    )
    expect(registeredSkillArtworkSource('lifebinder.mend')).toBe(icon?.previewSrc)
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
        sampleAssetId: 'audio.phase4.ironfist-action-v01-1',
      }),
    )
    const vanguard = resolveSkillAudioCueHook('skill.vanguard.forceful-strike.audio')
    expect(vanguard).toEqual(
      expect.objectContaining({
        skillId: 'vanguard.forceful-strike',
        available: false,
        audioFamily: null,
      }),
    )
    expect(skillAudioCueHookOptions.length).toBeGreaterThan(10)
    expect(isRegisteredSkillAudioCueHook('skill.vanguard.forceful-strike.audio')).toBe(true)
    expect(isRegisteredSkillAudioCueHook('skill.unknown.audio')).toBe(false)
  })
})
