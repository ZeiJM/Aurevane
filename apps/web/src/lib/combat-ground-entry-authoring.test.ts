import { expect, it } from 'vitest'
import { withRemappedGroundEntries } from './combat-ground-entry-authoring'
import * as groundAuthoring from './combat-ground-entry-authoring'
import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'

const target: CombatTargetSpec = {
  kind: 'ground-tile',
  geometryVersion: 3,
  categories: ['ground'],
  teamPolicy: 'any',
  shape: { kind: 'single' },
  minimumRange: 0,
  maximumRange: 3,
  requiresLineOfSight: false,
  maximumElevationDifference: null,
  friendlyFire: 'all-units',
}
const groundHit = {
  type: 'damage' as const,
  recipient: 'affected-units' as const,
  target: 'ground' as const,
  amount: 5,
}

it('persists current native Ground defaults and removes them after deliberate last-Ground removal', () => {
  const normalize = groundAuthoring.withCurrentSkillGroundArea
  const source = { target, effects: [groundHit] as readonly CombatEffectDefinition[] }
  const saved = normalize(source)
  expect(saved.groundArea).toMatchObject({
    durationRounds: 2,
    visualPresetId: 'arcane-pulse',
    entryEffectOrdinals: [0],
    contactPolicyVersion: 1,
    placementTimingVersion: 1,
    targetTeams: 'all',
  })
  expect(source).not.toHaveProperty('groundArea')
  const next = normalize(saved, {
    ...saved,
    target: { ...target, kind: 'unit', categories: ['enemy'] },
    effects: [{ ...groundHit, target: 'enemy' }],
  })
  expect(next).not.toHaveProperty('groundArea')
})
it.each([
  ['any', 'all-units', 'all'],
  ['any', 'all-except-actor', 'all-except-self'],
  ['enemy', 'enemies-only', 'enemies'],
  ['ally', 'allies-only', 'allies'],
  ['ally', 'all-except-actor', 'allies-except-self'],
  ['self', 'allies-only', 'self'],
] as const)(
  'preserves the %s/%s membership when deriving current defaults',
  (teamPolicy, friendlyFire, expected) => {
    const value = groundAuthoring.withCurrentSkillGroundArea({
      target: { ...target, teamPolicy, friendlyFire },
      effects: [groundHit],
    })
    expect(value.groundArea?.targetTeams).toBe(expected)
  },
)
it('keeps custom profile values and stable canonical entry links through current normalization', () => {
  const group = {
    id: 'main',
    mode: 'action',
    activation: 'manual',
    classification: 'attack',
    attackFamily: 'physical',
    costs: [],
    cooldown: null,
    requirements: null,
    targeting: { ...target, maximumSelections: 1 },
    effects: [
      { id: 'hit', payload: groundHit },
      { id: 'self', payload: { type: 'healing', recipient: 'actor', target: 'self', amount: 1 } },
    ],
    groundArea: {
      durationRounds: 9,
      visualPresetId: 'frost',
      timing: 'delayed',
      entryEffectIds: ['hit'],
      targetTeams: 'allies',
    },
  } as unknown as AbilityBehavior
  expect(groundAuthoring.withCurrentAbilityGroundArea(group).groundArea).toEqual({
    ...group.groundArea,
    contactPolicyVersion: 1,
    placementTimingVersion: 1,
  })
  expect(
    groundAuthoring.withCurrentAbilityGroundArea({
      ...group,
      effects: [...group.effects].reverse(),
    }).groundArea?.entryEffectIds,
  ).toEqual(['hit'])
})
it('leaves unsupported raw profiles untouched and never gives unit-only siblings a field', () => {
  const invalid = {
    target,
    effects: [groundHit],
    groundArea: { durationRounds: 4, visualPresetId: 'frost' as const, entryEffectOrdinals: [99] },
  }
  expect(groundAuthoring.withCurrentSkillGroundArea(invalid)).toBe(invalid)
  const unit = {
    target: { ...target, kind: 'unit' as const, categories: ['enemy' as const] },
    effects: [
      { ...groundHit, target: 'enemy' as const },
      { type: 'healing', recipient: 'actor', target: 'self' as const, amount: 1 },
    ],
  }
  expect(groundAuthoring.withCurrentSkillGroundArea(unit)).toBe(unit)
})
it.each([
  null,
  { durationRounds: 2, visualPresetId: 'frost', entryEffectIds: ['hit'], unsupportedSetting: true },
])('preserves malformed canonical Ground profiles for strict rejection: %j', (groundArea) => {
  const group = {
    id: 'main',
    mode: 'action',
    targeting: { ...target, maximumSelections: 1 },
    effects: [{ id: 'hit', payload: groundHit }],
    groundArea,
  } as unknown as AbilityBehavior
  expect(groundAuthoring.withCurrentAbilityGroundArea(group)).toBe(group)
})
it('removes a deliberately retargeted Self packet from a field while retaining other Ground entries', () => {
  const heal = {
    type: 'healing' as const,
    recipient: 'affected-units' as const,
    target: 'ground' as const,
    amount: 1,
  }
  const previous = groundAuthoring.withCurrentSkillGroundArea({
    target,
    effects: [groundHit, heal] as readonly CombatEffectDefinition[],
  })
  const next = groundAuthoring.withCurrentSkillGroundArea(previous, {
    ...previous,
    effects: [groundHit, { ...heal, recipient: 'actor', target: 'self' }],
  })
  expect(next.groundArea?.entryEffectOrdinals).toEqual([0])
  const canonical = {
    id: 'main',
    mode: 'action',
    targeting: { ...target, maximumSelections: 1 },
    effects: [
      { id: 'hit', payload: groundHit },
      { id: 'heal', payload: heal },
    ],
    groundArea: { durationRounds: 4, visualPresetId: 'frost', entryEffectIds: ['hit', 'heal'] },
  } as unknown as AbilityBehavior
  expect(
    groundAuthoring.withCurrentAbilityGroundArea(canonical, {
      ...canonical,
      effects: [
        canonical.effects[0]!,
        { ...canonical.effects[1]!, payload: { ...heal, recipient: 'actor', target: 'self' } },
      ],
    }).groundArea?.entryEffectIds,
  ).toEqual(['hit'])
})
it('keeps native Ground entries on the same effects through removal and reordering', () => {
  const hit = { type: 'damage' },
    poison = { type: 'poison' },
    buff = { type: 'apply-status' }
  const previous = {
    effects: [hit, poison, buff],
    groundArea: {
      durationRounds: 2,
      visualPresetId: 'arcane-pulse' as const,
      entryEffectOrdinals: [0, 1],
    },
  }
  expect(
    withRemappedGroundEntries(previous, { ...previous, effects: [buff, poison] }).groundArea
      ?.entryEffectOrdinals,
  ).toEqual([1])
  expect(
    withRemappedGroundEntries(previous, { ...previous, effects: [buff] }).groundArea,
  ).toBeUndefined()
})
