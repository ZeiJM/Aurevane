import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { combatCategoryForAuthoring, combatCategoryIssues } from './combat-category-authoring'

it('projects current Skill actions to Manual without mutating saved definitions', () => {
  const ability = structuredClone(
    defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability,
  )
  const definition = {
    id: 'custom.skill',
    ability: {
      ...ability,
      behaviors: ability.behaviors.map((b) => ({
        ...b,
        activation: 'automatic',
        automaticTarget: { subject: 'selected' },
        automaticTrigger: 'turn-started',
      })),
    },
  }
  const before = structuredClone(definition)
  const next = combatCategoryForAuthoring('skill', definition)
  expect(next.ability.behaviors[0]).toMatchObject({ activation: 'manual', mode: 'action' })
  expect(next.ability.behaviors[0]).not.toHaveProperty('automaticTarget')
  expect(next.ability.behaviors[0]).not.toHaveProperty('automaticTrigger')
  expect(definition).toEqual(before)
})
it('rejects incompatible modifiers and Manual Resonances without inventing triggers', () => {
  const ability = structuredClone(
    defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability,
  )
  const definition = {
    id: 'custom.skill',
    ability: { ...ability, behaviors: ability.behaviors.map((b) => ({ ...b, mode: 'modifier' })) },
  }
  expect(combatCategoryIssues('skill', definition)).toHaveLength(1)
  expect(combatCategoryIssues('resonance', { ...definition, ability })).toHaveLength(1)
  expect(combatCategoryForAuthoring('resonance', { ...definition, ability }).ability).toEqual(
    ability,
  )
  expect(combatCategoryIssues('skill', { ...definition, id: 'unarmed.basic' })).toEqual([])
})
it('respects root Essence ability ownership and preserves valid passive execution', () => {
  const ability = structuredClone(
    defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability,
  )
  const passive = {
    ...ability,
    behaviors: ability.behaviors.map((b) => ({ ...b, activation: 'automatic' })),
  }
  const definition = { essenceId: 'custom.essence', ability, skill: { ability: passive } }
  expect(combatCategoryIssues('essence', definition)).toEqual([])
  expect(combatCategoryForAuthoring('essence', definition).skill).toEqual(definition.skill)
  expect(combatCategoryIssues('resonance', { ability: passive })).toEqual([])
  expect(combatCategoryForAuthoring('resonance', { ability: passive })).toEqual({
    ability: passive,
  })
})
