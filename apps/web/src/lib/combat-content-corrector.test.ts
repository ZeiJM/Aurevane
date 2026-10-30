import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { correctCombatContentEntries } from './combat-content-corrector'

function fixture() {
  const ability = structuredClone(
    defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability,
  )
  const group = ability.behaviors[0]!
  return {
    id: 'custom.intent',
    name: 'Storm strike',
    ability: {
      ...ability,
      behaviors: [
        {
          ...group,
          requirements: {
            kind: 'status-presence',
            subject: 'owner',
            statusId: 'inspired',
            present: true,
          },
          targeting: {
            ...group.targeting!,
            geometryVersion: 3,
            shape: { kind: 'line', length: 16 },
            minimumRange: 0,
            maximumRange: 7,
          },
          effects: [
            {
              id: 'hit',
              payload: {
                type: 'damage',
                recipient: 'affected-units',
                target: 'enemy',
                amount: 21,
                element: 'storm',
              },
            },
            {
              id: 'charge',
              payload: {
                type: 'apply-status',
                recipient: 'affected-units',
                target: 'enemy',
                statusId: 'conductive',
                stacks: 1,
                durationTurns: 5,
                potencyBasisPoints: 5100,
              },
            },
          ],
        },
      ],
    },
  }
}
it('repairs bounded entries while preserving the authored purpose, targets, requirements and identities', () => {
  const original = fixture()
  const before = structuredClone(original)
  const result = correctCombatContentEntries('skill', original)
  const group = result.definition.ability.behaviors[0]!
  expect(group.targeting).toMatchObject({ shape: { kind: 'line', length: 15 }, maximumRange: 15 })
  expect(group.effects[0]).toMatchObject({
    id: 'hit',
    payload: { amount: 20, element: 'storm', target: 'enemy' },
  })
  expect(group.effects[1]).toMatchObject({
    id: 'charge',
    payload: { durationTurns: 4, potencyBasisPoints: 5000 },
  })
  expect(group.requirements).toEqual(before.ability.behaviors[0]!.requirements)
  expect(group.classification).toEqual(before.ability.behaviors[0]!.classification)
  expect(original).toEqual(before)
  expect(result.corrections.join(' ')).toMatch(/duration.*5.*4/i)
  expect(correctCombatContentEntries('skill', result.definition).corrections).toEqual([])
})
it('adds a required companion without removing or rewriting authored conditional effects', () => {
  const original = fixture()
  original.ability.behaviors[0]!.effects.pop()
  const result = correctCombatContentEntries('skill', original)
  expect(result.definition.ability.behaviors[0]!.effects).toHaveLength(2)
  expect(result.definition.ability.behaviors[0]!.effects[1]).toMatchObject({
    payload: { type: 'apply-status', statusId: 'conductive', target: 'enemy' },
  })
  expect(result.corrections.join(' ')).toMatch(/required.*Conductive/i)
})
it('does not guess unknown tags, missing targets, passive triggers or values with no finite numeric intent', () => {
  const original = {
    id: 'custom.passive',
    ability: {
      behaviors: [
        {
          activation: 'manual',
          mode: 'action',
          targeting: null,
          effects: [{ id: 'custom', payload: { type: 'unknown', amount: 'five' } }],
        },
      ],
    },
  }
  expect(correctCombatContentEntries('resonance', original)).toEqual({
    definition: original,
    corrections: [],
  })
})
it.each(['skill', 'essence'] as const)(
  'keeps %s effect notes aligned when adding a required companion',
  (kind) => {
    const skill = fixture()
    skill.ability.behaviors[0]!.effects.pop()
    const input =
      kind === 'skill'
        ? { ...skill, effectDescriptions: ['Authored note'] }
        : { ability: skill.ability, skill: { ...skill, effectDescriptions: ['Authored note'] } }
    const result = correctCombatContentEntries(kind, input).definition
    const descriptions =
      'skill' in result && result.skill
        ? result.skill.effectDescriptions
        : result.effectDescriptions
    expect(descriptions).toEqual(['Authored note', null])
  },
)
it('leaves extreme numeric intent for strict validation', () => {
  const original = fixture()
  original.ability.behaviors[0]!.effects[0]!.payload.amount = 999
  expect(
    correctCombatContentEntries('skill', original).definition.ability.behaviors[0]!.effects[0]!
      .payload.amount,
  ).toBe(999)
})
