import { expect, expectTypeOf, it } from 'vitest'
import { projectPublicCombat } from './public-combat-presentation'

it('omits canonical and legacy accuracy authoring recursively while preserving numeric stats and independent rolls', () => {
  const privateData = {
    accuracy: 8750,
    evasion: 200,
    forecast: { hitChanceBasisPoints: 6500 },
    proc: { chanceBasisPoints: 1250 },
    skill: {
      accuracyMode: 'per-target',
      accuracyModifierBasisPoints: 300,
      accuracyRule: { kind: 'fixed', chanceBasisPoints: 8888 },
      ability: {
        behaviors: [
          {
            accuracy: { kind: 'fixed', chanceBasisPoints: 7777 },
            costs: [{ resource: 'hp', amount: 2 }],
          },
        ],
      },
      effects: [
        {
          type: 'summon',
          profile: {
            stats: { accuracy: 8000 },
            abilities: [
              {
                accuracyRule: { kind: 'fixed', chanceBasisPoints: 9999 },
                proc: { chanceBasisPoints: 2500 },
              },
            ],
          },
        },
      ],
    },
  }
  const before = JSON.stringify(privateData)
  const result = projectPublicCombat(privateData)
  expect(result).toEqual({
    accuracy: 8750,
    evasion: 200,
    forecast: { hitChanceBasisPoints: 6500 },
    proc: { chanceBasisPoints: 1250 },
    skill: {
      ability: { behaviors: [{ costs: [{ resource: 'hp', amount: 2 }] }] },
      effects: [
        {
          type: 'summon',
          profile: {
            stats: { accuracy: 8000 },
            abilities: [{ proc: { chanceBasisPoints: 2500 } }],
          },
        },
      ],
    },
  })
  expect(JSON.stringify(result)).not.toMatch(
    /accuracyRule|accuracyMode|accuracyModifierBasisPoints|7777|8888|9999/,
  )
  expect(JSON.stringify(privateData)).toBe(before)
  expect(result.skill.effects).not.toBe(privateData.skill.effects)
})
it('fails closed on non-JSON and cyclic data, omitting malformed authoring objects rather than copying them', () => {
  expect(
    projectPublicCombat({ nested: [{ accuracy: { broken: 'private' } }], accuracy: 123 }),
  ).toEqual({ nested: [{}], accuracy: 123 })
  let deep: Record<string, unknown> = {}
  for (let index = 0; index < 130; index++) deep = { nested: deep }
  const cyclic: Record<string, unknown> = {}
  cyclic.self = cyclic
  for (const value of [
    deep,
    cyclic,
    { value: new Map() },
    { value: Infinity },
    { value: () => 'secret' },
  ])
    expect(() => projectPublicCombat(value)).toThrow(TypeError)
  const shared = { value: 4 }
  expect(projectPublicCombat([shared, shared])).toEqual([{ value: 4 }, { value: 4 }])
})

it('preserves branded primitive types and removes hit-authoring keys from public types', () => {
  type CombatId = string & { readonly __combatId: true }
  const value = projectPublicCombat({
    id: 'actor' as CombatId,
    accuracy: 7500,
    ability: { accuracy: { kind: 'standard' as const }, amount: 3 },
    accuracyRule: { kind: 'standard' as const },
  })
  expectTypeOf(value.id).toEqualTypeOf<CombatId>()
  expectTypeOf(value.accuracy).toEqualTypeOf<number>()
  expectTypeOf<keyof typeof value>().toEqualTypeOf<'id' | 'accuracy' | 'ability'>()
  expectTypeOf<keyof typeof value.ability>().toEqualTypeOf<'amount'>()
  expect(value.id).toBe('actor')
})

it('omits private Reversal hit bindings recursively without mutating captured state', () => {
  const captured = {
    nextReversalAttackCommandId: 4,
    reversalState: { armed: [{ sourceAbilityId: 'private.reversal' }] },
    pendingEffects: [
      { amount: 40, reversalAttackCommandId: 3, reversalDamageOrdinal: 0 },
      {
        durationTurns: 2,
        reversalAttackCommandId: 3,
        reversalBoundDamageOrdinalsByRecipient: { enemy: 0 },
      },
    ],
  }
  const before = JSON.stringify(captured)
  const visible = projectPublicCombat(captured)
  expect(visible).toEqual({ pendingEffects: [{ amount: 40 }, { durationTurns: 2 }] })
  expect(JSON.stringify(captured)).toBe(before)
  expectTypeOf<keyof typeof visible>().toEqualTypeOf<'pendingEffects'>()
})
