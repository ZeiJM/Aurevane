import { expect, it } from 'vitest'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import {
  hasRetiredSkillAccuracyModifier,
  skillAccuracyForAuthoring,
} from './skill-accuracy-authoring'

it('current built-in fallback Skills and Essences have no active per-Skill modifier', () => {
  expect(
    [...latestEnabledMatureSkills(), ...currentEssenceDefinitions().map((row) => row.skill)]
      .filter((row) => (row.accuracyModifierBasisPoints ?? 0) !== 0)
      .map((row) => row.id),
  ).toEqual([])
})

it('preserves accuracy mode, canonical chance, status modifiers and all effect tuning', () => {
  const value = {
    accuracyMode: 'per-target',
    accuracyModifierBasisPoints: 700,
    ability: { behaviors: [{ accuracy: { kind: 'fixed', chance: 6000 } }] },
    effects: [{ type: 'apply-status', parameters: { accuracyModifierBasisPoints: 500 } }],
  }
  expect(skillAccuracyForAuthoring('skill', value)).toEqual({
    accuracyMode: 'per-target',
    ability: value.ability,
    effects: value.effects,
  })
  expect(value.accuracyModifierBasisPoints).toBe(700)
})
it('only normalizes supported Skill bodies and accepts neutral historical draft values', () => {
  const value = { accuracyModifierBasisPoints: 0 }
  expect(skillAccuracyForAuthoring('skill', value)).toEqual({})
  expect(hasRetiredSkillAccuracyModifier('skill', value)).toBe(false)
  expect(hasRetiredSkillAccuracyModifier('skill', { accuracyModifierBasisPoints: -500 })).toBe(true)
  expect(skillAccuracyForAuthoring('status', { accuracyModifierBasisPoints: 700 })).toEqual({
    accuracyModifierBasisPoints: 700,
  })
  expect(hasRetiredSkillAccuracyModifier('status', { accuracyModifierBasisPoints: 700 })).toBe(
    false,
  )
})
