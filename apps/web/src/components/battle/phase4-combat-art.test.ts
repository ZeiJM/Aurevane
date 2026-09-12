import * as matureSkills from '@aurevane/game-core/combat/mature-skills'
import { describe, expect, it, vi } from 'vitest'

import { phase4SkillArtwork } from './phase4-combat-art'

const affectedSkillIds = [
  'chronist.haste',
  'chronist.delay',
  'stormsinger.static-drain',
  'tidecaller.water-lance',
]

function effectBadge(source: string): string {
  return (
    decodeURIComponent(source).match(
      /<g\b[^>]*transform="translate\(93 93\)"[^>]*>(.*?)<\/g>/,
    )?.[1] ?? ''
  )
}

describe('Phase 4 Skill effect artwork', () => {
  it.each(affectedSkillIds)('renders a visible effect badge for %s', (skillId) => {
    const artwork = phase4SkillArtwork(skillId)
    expect(artwork).toMatch(/^data:image\/svg\+xml,/)
    expect(effectBadge(artwork!)).toMatch(/<(?:path|circle|rect)\b/)
    expect(decodeURIComponent(artwork!)).not.toContain('undefined')
  })

  it('keeps every current generated Skill badge complete', () => {
    for (const skill of matureSkills.latestEnabledMatureSkills()) {
      const artwork = phase4SkillArtwork(skill.id)
      if (!artwork?.startsWith('data:image/svg+xml,')) continue
      expect(effectBadge(artwork), skill.id).toMatch(/<(?:path|circle|rect)\b/)
      expect(decodeURIComponent(artwork), skill.id).not.toContain('undefined')
    }
  })

  it('uses visible neutral geometry for an unrecognized status without inventing a Skill', () => {
    const authoredBadges = affectedSkillIds.map((id) => effectBadge(phase4SkillArtwork(id)!))
    expect(new Set(authoredBadges).size).toBe(affectedSkillIds.length)
    const skill = matureSkills.resolveMatureSkillVersion('chronist.haste')!
    const resolver = vi.spyOn(matureSkills, 'resolveMatureSkillVersion').mockReturnValue({
      ...skill,
      effects: [
        { type: 'apply-status', recipient: 'primary-unit', statusId: 'future-status', stacks: 1 },
      ],
    })
    try {
      const artwork = phase4SkillArtwork(skill.id)!
      expect(effectBadge(artwork)).toMatch(/<(?:path|circle|rect)\b/)
      expect(decodeURIComponent(artwork)).not.toContain('undefined')
      expect(authoredBadges).not.toContain(effectBadge(artwork))
    } finally {
      resolver.mockRestore()
    }
    expect(phase4SkillArtwork('chronist.unknown')).toBeNull()
  })
})
