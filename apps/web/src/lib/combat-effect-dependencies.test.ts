import { expect, it } from 'vitest'
import type { CombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import { reconcileAuthoredEffectDependencies } from './combat-effect-dependencies'
const poison: CombatTagPayload = {
  type: 'poison',
  recipient: 'primary-unit',
  target: 'enemy',
  durationTurns: 4,
  damageProfile: { kind: 'attack-percentage', basisPoints: 1500 },
}
const burn: CombatTagPayload = {
  type: 'burn',
  recipient: 'primary-unit',
  target: 'enemy',
  durationTurns: 3,
  damageProfile: { kind: 'attack-percentage', basisPoints: 2500, decayBasisPointsPerTick: 500 },
}
it('adds one editable Damage shared by compatible DoTs and removes it after the last dependency', () => {
  const first = reconcileAuthoredEffectDependencies<CombatTagPayload>([], [poison])
  expect(first.map((x) => x.type)).toEqual(['damage', 'poison'])
  const shared = reconcileAuthoredEffectDependencies<CombatTagPayload>(first, [...first, burn])
  expect(shared.filter((x) => x.type === 'damage')).toHaveLength(1)
  const one = reconcileAuthoredEffectDependencies<CombatTagPayload>(
    shared,
    shared.filter((x) => x.type !== 'poison'),
  )
  expect(one.map((x) => x.type)).toEqual(['damage', 'burn'])
  expect(
    reconcileAuthoredEffectDependencies<CombatTagPayload>(
      one,
      one.filter((x) => x.type !== 'burn'),
    ),
  ).toEqual([])
})
it('removing Damage removes dependent DoTs but retains unrelated effects', () => {
  const first = reconcileAuthoredEffectDependencies<CombatTagPayload>([], [poison])
  const buff: CombatTagPayload = {
    type: 'apply-status',
    recipient: 'actor',
    statusId: 'haste',
    stacks: 1,
  }
  expect(reconcileAuthoredEffectDependencies<CombatTagPayload>(first, [poison, buff])).toEqual([
    buff,
  ])
})
it('preserves independently authored Damage and distinct target coverage', () => {
  const damage: CombatTagPayload = {
    type: 'damage',
    recipient: 'primary-unit',
    target: 'enemy',
    amount: 9,
  }
  expect(reconcileAuthoredEffectDependencies<CombatTagPayload>([damage], [damage, poison])).toEqual(
    [damage, poison],
  )
  expect(reconcileAuthoredEffectDependencies<CombatTagPayload>([damage, poison], [damage])).toEqual(
    [damage],
  )
  const area = { ...poison, target: 'all' as const, recipient: 'affected-units' as const }
  expect(
    reconcileAuthoredEffectDependencies<CombatTagPayload>([damage], [damage, area]).filter(
      (x) => x.type === 'damage',
    ),
  ).toHaveLength(2)
})
it('links Frozen Ground and Chilled in both removal directions across serialization', () => {
  const terrain: CombatTagPayload = {
    type: 'create-terrain',
    recipient: 'affected-tiles',
    terrain: 'frozen',
  }
  const first = JSON.parse(
    JSON.stringify(reconcileAuthoredEffectDependencies<CombatTagPayload>([], [terrain])),
  ) as CombatTagPayload[]
  expect(first.map((x) => x.type)).toEqual(['create-terrain', 'apply-status'])
  expect(first[1]).toMatchObject({ statusId: 'frozen', applicationOrigin: 'frozen-ground' })
  expect(
    reconcileAuthoredEffectDependencies<CombatTagPayload>(
      first,
      first.filter((x) => x.type !== 'create-terrain'),
    ),
  ).toEqual([])
  expect(
    reconcileAuthoredEffectDependencies<CombatTagPayload>(
      first,
      first.filter((x) => x.type !== 'apply-status'),
    ),
  ).toEqual([])
})

import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { withAbilityEffectDependencies } from './combat-ability-effect-dependencies'
it('keeps the original terrain row identity, conditions, timing and Ground references when adding Chilled', () => {
  const previous = { id: 'main', effects: [] } as unknown as AbilityBehavior
  const terrain = {
    id: 'terrain-original',
    timing: 'delayed' as const,
    requirements: {
      kind: 'status-presence' as const,
      subject: 'owner' as const,
      statusId: 'inspired',
      present: true,
    },
    payload: {
      type: 'create-terrain' as const,
      recipient: 'affected-tiles' as const,
      terrain: 'frozen' as const,
    },
  }
  const next = {
    ...previous,
    effects: [terrain],
    groundArea: { entryEffectIds: ['terrain-original'] },
  } as unknown as AbilityBehavior
  const result = withAbilityEffectDependencies(previous, next)
  expect(result.effects[0]).toMatchObject({
    id: 'terrain-original',
    requirements: terrain.requirements,
    timing: terrain.timing,
  })
  expect(result.groundArea).toEqual(next.groundArea)
  expect(result.effects[1]!.id).not.toBe('terrain-original')
  expect(result.effects[1]).toMatchObject({
    requirements: terrain.requirements,
    timing: terrain.timing,
  })
})
it('shares compatible Ground Damage with Enemy DoTs without adding a second hit', () => {
  const hit: CombatTagPayload = {
    type: 'damage',
    recipient: 'affected-units',
    target: 'ground',
    amount: 9,
  }
  const effect: CombatTagPayload = { ...poison, recipient: 'affected-units' }
  expect(reconcileAuthoredEffectDependencies<CombatTagPayload>([hit], [hit, effect])).toEqual([
    hit,
    effect,
  ])
})
it('classifies a new DoT as an attack even when independent Damage already covers it', () => {
  const hit = {
    id: 'hit',
    payload: {
      type: 'damage' as const,
      recipient: 'primary-unit' as const,
      target: 'enemy' as const,
      amount: 9,
    },
  }
  const previous = {
    id: 'main',
    classification: 'utility',
    effects: [hit],
  } as unknown as AbilityBehavior
  const next = { ...previous, effects: [hit, { id: 'poison', payload: poison }] }
  expect(withAbilityEffectDependencies(previous, next)).toMatchObject({
    classification: 'attack',
    attackFamily: 'physical',
  })
})
it('prunes removed persistent-ground references and disables an empty ground area', () => {
  const pair = reconcileAuthoredEffectDependencies<CombatTagPayload>([], [poison])
  const previous = {
    id: 'main',
    classification: 'attack',
    effects: pair.map((payload, index) => ({ id: `row${index}`, payload })),
    groundArea: { entryEffectIds: ['row0', 'row1'] },
  } as unknown as AbilityBehavior
  const next = {
    ...previous,
    effects: previous.effects.filter((row) => row.payload.type !== 'poison'),
  }
  const result = withAbilityEffectDependencies(previous, next)
  expect(result.effects).toHaveLength(0)
  expect(result.groundArea).toBeUndefined()
})

it.each(['weak-point', 'spike', 'ruin'] as const)(
  'links %s to one Damage packet while preserving independent damage',
  (type) => {
    const modifier = { type, recipient: 'actor' } as CombatTagPayload
    const first = reconcileAuthoredEffectDependencies<CombatTagPayload>([], [modifier])
    expect(first.map((row) => row.type)).toEqual(['damage', type])
    expect(first[0]).toMatchObject({ recipient: 'primary-unit', amount: 1 })
    expect(reconcileAuthoredEffectDependencies(first, [modifier])).toEqual([])
    expect(
      reconcileAuthoredEffectDependencies(
        first,
        first.filter((row) => row.type !== type),
      ),
    ).toEqual([])
    const hit = { type: 'damage', recipient: 'primary-unit', amount: 7 } as CombatTagPayload
    expect(reconcileAuthoredEffectDependencies([hit], [hit, modifier])).toEqual([hit, modifier])
  },
)

it('does not add or require direct Damage for retained flat DoTs that already work independently', () => {
  const flat: CombatTagPayload = {
    type: 'bleed',
    recipient: 'primary-unit',
    damagePerTick: 3,
    ticks: 3,
  }
  const hit: CombatTagPayload = { type: 'damage', recipient: 'primary-unit', amount: 7 }
  expect(reconcileAuthoredEffectDependencies<CombatTagPayload>([], [flat])).toEqual([flat])
  expect(reconcileAuthoredEffectDependencies<CombatTagPayload>([hit, flat], [flat])).toEqual([flat])
})
