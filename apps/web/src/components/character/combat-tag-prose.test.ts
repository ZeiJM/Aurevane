import { expect, it } from 'vitest'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import { mechanicTagExplanation } from './mechanic-tag-explanation'
import { previewEffect } from './skill-effect-preview'
import { skillEffectDescription } from './skill-detail-presentation'
import { canonicalEffectExplanation } from './canonical-effect-explanation'
import { statusPotencyDescription } from '@/lib/status-potency-presentation'

it('explains configured Reveal in compact readers and retains omitted-field history', () => {
  const old = {
    type: 'sensory' as const,
    recipient: 'primary-unit' as const,
    revealedDurationOwnerTurnStarts: 3,
  }
  const current = previewEffect({ ...old, increasedDamageTakenBasisPoints: 3250 })
  expect(current.explanation).toContain('Invisible or Covert')
  expect(current.explanation).toContain('32.5%')
  expect(current.explanation).toContain('100% Accuracy')
  expect(current.explanation).not.toContain('eligible buffs')
  expect(previewEffect(old).explanation).toContain('eligible buffs')
})

it('keeps generic status references free of invented magnitudes and outdated mechanics', () => {
  expect(mechanicTagExplanation('fortified', {})).toContain('Physical and Mystic Defense')
  expect(mechanicTagExplanation('wet', {})).not.toMatch(/\d+%/)
  expect(mechanicTagExplanation('frozen-ground', {})).not.toMatch(/10|movement AP/)
  expect(mechanicTagExplanation('poison', {})).toContain('refresh')
  expect(mechanicTagExplanation('poison', {})).not.toContain('trigger on movement')
  expect(mechanicTagExplanation('invisible', {})).toContain('Reveal')
})

it('does not borrow a containing Skill’s grant potency for a generic Drenched reference', () => {
  const skillEffects = [
    {
      type: 'apply-status' as const,
      recipient: 'primary-unit' as const,
      statusId: 'wet',
      stacks: 1,
      potencyBasisPoints: 3500,
      initiativeReductionBasisPoints: 2500,
    },
  ]
  expect(mechanicTagExplanation('wet', { skillEffects })).not.toContain('25%')
  expect(mechanicTagExplanation('wet', { skillEffects })).not.toContain('35%')
})

it.each([
  'guarded',
  'exposed',
  'inspired',
  'hexed',
  'suppress',
  'reckless',
  'mark',
  'warded',
  'wet',
  'conductive',
  'blindside',
])('does not assign one fixed percentage to the generic %s description', (id) => {
  expect(combatStatusDetails(id).description).not.toMatch(/\d/)
})

it('keeps authored status values and historical Fortified tradeoffs in full readers', () => {
  const effect = {
    type: 'apply-status' as const,
    recipient: 'actor' as const,
    statusId: 'fortified',
    stacks: 1,
    durationTurns: 3,
  }
  expect(skillEffectDescription({ ...effect, defenseIncreaseBasisPoints: 3250 })).toContain('32.5%')
  expect(skillEffectDescription({ ...effect, defenseIncreaseBasisPoints: 3250 })).toContain(
    'Physical and Mystic Defense',
  )
  expect(skillEffectDescription(effect)).toContain('30% less damage and deal 20% less damage')
  expect(
    skillEffectDescription({ ...effect, statusId: 'slow', movementApAdjustment: 27 }),
  ).toContain('27 extra AP')
  expect(statusPotencyDescription('guarded')).toContain('15%')
  expect(statusPotencyDescription('warded')).toContain('20%')
})

it('does not claim constant-damage Burn must weaken on each tick', () => {
  const effect = {
    type: 'burn' as const,
    recipient: 'primary-unit' as const,
    durationTurns: 3,
    damageProfile: {
      kind: 'attack-percentage' as const,
      basisPoints: 2500,
      decayBasisPointsPerTick: 0,
    },
  }
  expect(canonicalEffectExplanation(effect, {})?.description).not.toContain('decreasing')
  expect(
    canonicalEffectExplanation(
      { ...effect, damageProfile: { ...effect.damageProfile, decayBasisPointsPerTick: 500 } },
      {},
    )?.description,
  ).toContain('decreasing')
})

it('shows the new Blindside debuff’s saved values without describing the historical caster buff', () => {
  const effect = {
    type: 'apply-status' as const,
    recipient: 'primary-unit' as const,
    statusId: 'blindside-vulnerability',
    stacks: 1,
    durationTurns: 1,
    blindsideModifiersBasisPoints: { side: 17550, rear: 25000 },
  }
  expect(previewEffect(effect).explanation).toContain('175.5%')
  expect(previewEffect(effect).explanation).toContain('250%')
  expect(previewEffect(effect).explanation).toContain('Front hits and Basic Attack are unchanged')
  expect(previewEffect(effect).explanation).not.toContain('granting Skill')
})
