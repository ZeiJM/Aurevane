import { expect, it } from 'vitest'
import { combatDamageForAuthoring } from './combat-damage-authoring'
const pierce = {
  id: 'pierce',
  payload: {
    type: 'pierce',
    recipient: 'affected-units',
    target: 'enemy',
    element: 'storm',
    amount: 1,
    armorIgnoredBasisPoints: 2500,
  },
}
const generated = {
  id: 'element-companion.conductive.affected-units',
  payload: {
    type: 'apply-status',
    recipient: 'affected-units',
    target: 'enemy',
    statusId: 'conductive',
    stacks: 1,
    durationTurns: 2,
    potencyBasisPoints: 2000,
  },
}
function definition(effects = [pierce, generated], classification = 'utility') {
  return {
    id: 'custom.skill',
    ability: {
      schemaVersion: 1,
      behaviors: [{ id: 'main', classification, activation: 'manual', mode: 'action', effects }],
    },
    effectDescriptions: effects.map((effect) => effect.id),
  }
}
it('removes Pierce element and unused default generated companion independently of damage classification', () => {
  const value = definition()
  const before = structuredClone(value)
  const next = combatDamageForAuthoring('skill', value)
  expect(next.ability.behaviors[0]!.effects).toHaveLength(1)
  expect(next.ability.behaviors[0]!.effects[0]!.payload).not.toHaveProperty('element')
  expect(next.effectDescriptions).toEqual(['pierce'])
  expect(value).toEqual(before)
})
it('preserves custom, conditional, timed and shared companions', () => {
  for (const companion of [
    { ...generated, id: 'manual-charge' },
    { ...generated, requirements: { kind: 'prime-presence', subject: 'owner', present: true } },
    { ...generated, timing: 'delayed' },
    { ...generated, payload: { ...generated.payload, potencyBasisPoints: 3525, durationTurns: 3 } },
  ]) {
    const value = definition([pierce, companion])
    expect(combatDamageForAuthoring('skill', value).ability.behaviors[0]!.effects).toHaveLength(2)
  }
  const damage = { ...pierce, id: 'ordinary', payload: { ...pierce.payload, type: 'damage' } }
  expect(
    combatDamageForAuthoring('skill', definition([pierce, generated, damage])).ability.behaviors[0]!
      .effects,
  ).toHaveLength(3)
})
it('keeps nested Essence notes aligned with its root-owned Pierce mechanics', () => {
  const original = definition()
  const value = {
    essenceId: 'custom.essence',
    ability: original.ability,
    skill: { id: original.id, effectDescriptions: original.effectDescriptions },
  }
  const next = combatDamageForAuthoring('essence', value)
  expect(next.ability.behaviors[0]!.effects).toHaveLength(1)
  expect(next.skill.effectDescriptions).toEqual(['pierce'])
  expect(value.skill.effectDescriptions).toEqual(['pierce', generated.id])
})
