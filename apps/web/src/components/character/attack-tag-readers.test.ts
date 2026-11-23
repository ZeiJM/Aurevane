import { expect, it } from 'vitest'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { previewEffect, previewEffectWithTag, skillPreviewEffects } from './skill-effect-preview'
import { captureCombatTagPresentation } from '@aurevane/game-core/combat/combat-tag-registry'
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

it('explains current Ruin consumption and the retained historical rule in shared readers', () => {
  const effect = examples[2].effect as unknown as MatureSkillEffectDefinition
  for (const description of [
    previewEffect(effect).explanation,
    skillEffectDescription(effect),
    canonicalEffectExplanation(effect, {})?.description,
  ]) {
    expect(description).toContain('first landed')
    expect(description).toContain('consumes')
    expect(description).toContain('Later hits')
    expect(description).toContain('Historical battles')
  }
})

it('retains the nonconsuming Ruin explanation for an absent-policy captured battle', () => {
  const effect = examples[2].effect as unknown as MatureSkillEffectDefinition
  for (const description of [
    previewEffect(effect, { legacyRuin: true }).explanation,
    skillEffectDescription(effect, { legacyRuin: true }),
    canonicalEffectExplanation(effect, { legacyRuin: true })?.description,
  ]) {
    expect(description).toContain('253.75% per active debuff')
    expect(description).not.toContain('consumes')
    expect(description).not.toContain('Later hits')
  }
})

it('adds the current Ruin rule to old saved help without rewriting the captured wording', () => {
  const effect = examples[2].effect
  const saved = captureCombatTagPresentation({
    id: 'tag.ruin',
    tagId: 'ruin',
    contentVersion: 3,
    name: 'Ruin',
    explanation: 'Saved Ruin rule.',
    description: 'Saved short Ruin.',
  })
  const before = JSON.stringify(saved)
  const current = previewEffectWithTag(effect, [saved], { legacyRuin: false })
  expect(current.explanation).toContain('Saved Ruin rule.')
  expect(current.explanation).toContain('first landed')
  expect(current.explanation).toContain('consumes')
  expect(current.tagPresentation?.compact).toContain('first landed')
  expect(previewEffectWithTag(effect, [saved], { legacyRuin: true }).explanation).toBe(
    'Saved Ruin rule.',
  )
  const skill = { effects: [effect], effectDescriptions: ['Saved description.'] }
  expect(skillPreviewEffects(skill, { legacyRuin: false })[0]?.explanation).toContain(
    'first landed',
  )
  expect(skillPreviewEffects(skill, { legacyRuin: true })[0]?.explanation).toBe(
    'Saved description.',
  )
  expect(JSON.stringify(saved)).toBe(before)
})

it('does not mistake negated saved prose for the current Ruin rule or repeat known generated text', () => {
  const effect = examples[2].effect
  const contradictory = captureCombatTagPresentation({
    id: 'tag.ruin',
    tagId: 'ruin',
    contentVersion: 3,
    name: 'Ruin',
    explanation: 'Ruin does not consume debuffs. Later hits also gain Ruin.',
    description: 'Ruin never consumes debuffs.',
  })
  const current = previewEffectWithTag(effect, [contradictory], { legacyRuin: false })
  expect(current.explanation).toContain(
    'Current Ruin boosts the first landed eligible hit and consumes captured debuffs',
  )
  expect(current.tagPresentation?.compact).toContain('Current Ruin boosts the first landed')
  const generated = previewEffect(effect, { legacyRuin: false }).explanation
  const templated = captureCombatTagPresentation({
    id: 'tag.ruin',
    tagId: 'ruin',
    contentVersion: 4,
    name: 'Ruin',
    explanation: 'Additional context. {details}',
    description: '{summary}',
  })
  const rendered = previewEffectWithTag(effect, [templated], { legacyRuin: false })
  expect(rendered.explanation).toBe(`Additional context. ${generated}`)
  expect(rendered.tagPresentation?.compact).toBe(generated)
})

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
