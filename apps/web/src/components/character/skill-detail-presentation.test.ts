import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  skillAffectedDescription,
  skillEffectDescription,
  skillRangeDescription,
  skillRequirementDescription,
  skillTargetTags,
} from './skill-detail-presentation'

describe('Player-facing Skill targeting and effects', () => {
  it('distinguishes ranged area targeting from self recovery without changing the definition', () => {
    const volley = resolveMatureSkillVersion('farstrider.volley')!
    const before = JSON.stringify(volley)
    expect(skillTargetTags(volley)).toEqual(['Enemy', 'Area · radius 1', 'Damage'])
    expect(skillRangeDescription(volley)).toBe('2–5 tiles')
    expect(skillAffectedDescription(volley)).toBe('Enemies only')
    const breath = resolveMatureSkillVersion('ironfist.focus-breath')!
    expect(skillTargetTags(breath)).toEqual(['Self', 'Single target', 'Healing', 'MP'])
    expect(skillRangeDescription(breath)).toBe('Self only')
    expect(JSON.stringify(volley)).toBe(before)
  })
  it('describes prerequisites, negative resource changes, and facing explicitly', () => {
    expect(skillRequirementDescription({ kind: 'actor-status-present', statusId: 'guarded' })).toBe(
      'Requires Guarded on yourself.',
    )
    expect(
      skillRequirementDescription({ kind: 'target-status-present', statusId: 'exposed' }),
    ).toBe('Target must have Exposed.')
    expect(skillRequirementDescription({ kind: 'actor-hp-at-most', basisPoints: 5000 })).toBe(
      'Requires your HP at 50% or below.',
    )
    expect(
      skillEffectDescription({
        type: 'resource-change',
        resource: 'mp',
        delta: -5,
        recipient: 'primary-unit',
      }),
    ).toBe('Remove 5 MP from the selected unit.')
    const backstab = resolveMatureSkillVersion('shadehand.backstab')!
    expect(skillEffectDescription(backstab.effects[0]!)).toContain(
      'front 100%, side 130%, rear 170%',
    )
  })
})

it('names a linked tradeoff and explains both halves on the correct recipient', () => {
  const frenzy = resolveMatureSkillVersion('ravager.frenzy')!
  expect(skillTargetTags(frenzy)).toEqual(['Self', 'Single target', 'Reckless'])
  const description = skillEffectDescription(frenzy.effects[0]!)
  expect(description).toContain('to yourself')
  expect(description).toContain('Deal 40% more damage and take 25% more damage')
  expect(description).toContain('expire or are removed together')
})
it('describes source-specific modifiers, cleansing and periodic timing', () => {
  const mark = resolveMatureSkillVersion('wildwarden.hunters-mark')!
  expect(skillEffectDescription(mark.effects[0]!)).toContain('Other attackers gain no benefit')
  const burn = resolveMatureSkillVersion('cinderweaver.cinder-bolt')!
  expect(skillEffectDescription(burn.effects[1]!)).toContain('end-of-turn ticks')
  expect(skillTargetTags(resolveMatureSkillVersion('runeblade.unbinding-rune')!)).toContain(
    'Cleanse',
  )
})
