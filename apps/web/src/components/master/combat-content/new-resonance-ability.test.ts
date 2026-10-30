import { expect, it } from 'vitest'
import { validateAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { newResonanceAbility } from './new-resonance-ability'
it('starts new Resonances in the full shared editor with explicit automatic activation and self recipient', () => {
  const ability = newResonanceAbility()
  expect(validateAbilityDefinition(ability)).toEqual([])
  expect(ability.behaviors[0]).toMatchObject({
    activation: 'automatic',
    mode: 'action',
    automaticTrigger: 'turn-started',
    activationLimits: ['once-per-round'],
    targeting: { kind: 'self' },
    effects: [{ payload: { target: 'self', type: 'barrier-change' } }],
  })
  expect(newResonanceAbility()).not.toBe(ability)
})
