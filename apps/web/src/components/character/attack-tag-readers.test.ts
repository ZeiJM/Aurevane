import { expect, it } from 'vitest'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { previewEffect } from './skill-effect-preview'
import { compactSkillEffectSummaryParts, skillEffectDescription } from './skill-detail-presentation'
import { canonicalEffectExplanation } from './canonical-effect-explanation'
import { abilityBehaviorInformation } from './ability-detail-presentation'

const examples = [
  {
    effect: { type: 'weak-point', recipient: 'actor', debuffThreshold: 3 },
    label: 'Weak Point',
    magnitude: '> 3 debuffs',
    words: /more than 3 (?:distinct )?(?:active )?(?:negative )?(?:debuffs|statuses)/i,
  },
  {
    effect: { type: 'spike', recipient: 'actor' },
    label: 'Spike',
    magnitude: '2× critical damage',
    words: /critical.*(?:double|twice)|(?:double|twice).*critical/i,
  },
  {
    effect: { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 25375 },
    label: 'Ruin',
    magnitude: '+253.75% per debuff',
    words: /253\.75%.*(?:each|per).*(?:debuff|negative status)/i,
  },
] as const

it.each(examples)(
  'describes saved $label values in native and canonical readers',
  ({ effect: raw, label, magnitude, words }) => {
    const effect = raw as unknown as MatureSkillEffectDefinition
    const preview = previewEffect(effect)
    expect(preview).toMatchObject({ label, magnitude })
    expect(preview.explanation).toMatch(words)
    expect(skillEffectDescription(effect)).toMatch(words)
    expect(canonicalEffectExplanation(effect, {})?.description).toMatch(words)
    const compact = compactSkillEffectSummaryParts(effect)
    expect(compact).toMatchObject({ label, magnitude, duration: null })
    expect(compact.target).toBeUndefined()
    expect(compact.timing).toBeUndefined()
  },
)

it('states that Weak Point guarantees a critical hit without guaranteeing a hit', () => {
  const effect = examples[0].effect as unknown as MatureSkillEffectDefinition
  expect(skillEffectDescription(effect)).toMatch(/critical/i)
  expect(skillEffectDescription(effect)).toMatch(
    /does not guarantee.*hit|must.*hit|still.*hit|(?:successful|landed).*hit|(?:hit|accuracy).*unchanged/i,
  )
})

it.each(examples)(
  'keeps $label as a Damage modifier without a separate canonical target or timer',
  ({ effect }) => {
    const behavior = {
      id: 'attack',
      activation: 'manual',
      mode: 'action',
      classification: 'attack',
      attackFamily: 'physical',
      costs: [],
      cooldown: null,
      requirements: null,
      targeting: {
        kind: 'unit',
        teamPolicy: 'enemy',
        friendlyFire: 'enemies-only',
        shape: { kind: 'single' },
        minimumRange: 1,
        maximumRange: 4,
        requiresLineOfSight: false,
        maximumElevationDifference: 1,
        maximumSelections: 1,
      },
      effects: [
        { id: 'damage', payload: { type: 'damage', recipient: 'primary-unit', amount: 10 } },
        { id: 'modifier', payload: effect },
      ],
    } as unknown as AbilityBehavior
    const report = abilityBehaviorInformation(behavior, {
      timingPolicy: { version: 1, tagAuthority: 'global', modes: {} },
    })
    const modifier = report.effects[1]!.parts
    expect(modifier.target).toBeUndefined()
    expect(modifier.duration).toBeNull()
    expect(modifier.timing).toBeUndefined()
    expect(report.effects[0]!.parts.target).toBe('Enemy')
  },
)
