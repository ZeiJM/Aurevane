import { expect, it } from 'vitest'
import { projectPublicCombatGroundAreas } from './combat-ground-visuals'
import type { CombatEffectDefinition } from './actions'

const area = {
  id: 'ground.area.1',
  tiles: [{ x: 1, y: 1 }],
  activationRound: 3,
  expiresAtRound: 6,
  visualPresetId: 'arcane-pulse' as const,
}
const effects: CombatEffectDefinition[] = [
  { type: 'damage', recipient: 'primary-unit', amount: 20 },
  { type: 'damage', recipient: 'primary-unit', amount: 20, piercing: true },
  { type: 'apply-status', recipient: 'primary-unit', statusId: 'guarded', stacks: 1 },
  { type: 'apply-status', recipient: 'primary-unit', statusId: 'frozen', stacks: 1 },
  { type: 'percentage-recovery', recipient: 'primary-unit', resource: 'hp', percent: 25 },
  { type: 'percentage-recovery', recipient: 'primary-unit', resource: 'mp', percent: 25 },
  {
    type: 'resource-change',
    recipient: 'primary-unit',
    resource: 'mp',
    delta: -20,
    basis: 'maximum-mp-percent',
  },
  { type: 'remove-status', recipient: 'primary-unit', removalMode: 'all-debuffs', statusIds: [] },
]
it('compiles distinct current Ground visual identities without publishing its captured mechanics or source', () => {
  const captured = {
    ...area,
    contactPolicyVersion: 1 as const,
    entryEffects: effects,
    sourceCombatantId: 'secret:actor',
    sourceActionId: 'secret.skill',
    caster: { secret: 999 },
    content: { secret: true },
    effectVisualIds: ['secret.injected'],
  }
  const before = structuredClone(captured)
  expect(projectPublicCombatGroundAreas([captured], 2, 'active')).toEqual([
    {
      ...area,
      effectVisualIds: [
        'damage',
        'pierce',
        'status:guarded',
        'status:frozen',
        'hp-recovery',
        'mp-recovery',
        'mp-drain',
        'removal:cleanse',
      ],
    },
  ])
  expect(captured).toEqual(before)
})
it('retains the exact legacy preset projection and excludes expired or completed fields', () => {
  expect(projectPublicCombatGroundAreas([{ ...area, entryEffects: effects }], 2, 'active')).toEqual(
    [area],
  )
  expect(projectPublicCombatGroundAreas([area], 6, 'active')).toEqual([])
  expect(projectPublicCombatGroundAreas([area], 2, 'completed')).toEqual([])
})

it('projects retained Vengeance through Damage while keeping its Pierce variants distinct', () => {
  const damage: CombatEffectDefinition = {
    type: 'damage',
    recipient: 'affected-units',
    target: 'ground',
    amount: 0,
    vengeance: { conversionBasisPoints: 10000, maximumDamage: 20 },
  }
  for (const modifier of [{}, { piercing: true }, { shattersBarrier: true }] as const) {
    expect(
      projectPublicCombatGroundAreas(
        [{ ...area, contactPolicyVersion: 1, entryEffects: [{ ...damage, ...modifier }] }],
        2,
        'active',
      )[0]?.effectVisualIds,
    ).toEqual([Object.keys(modifier).length ? 'pierce' : 'damage'])
  }
})

it('explains immediate current logical contact while keeping legacy per-cast wording', async () => {
  const { combatGroundAreaDescription } = await import('./combat-ground-visuals')
  const current = combatGroundAreaDescription({
    durationRounds: 3,
    timing: 'instant',
    contactPolicyVersion: 1,
  })
  expect(current).toContain('Active fields apply immediately')
  expect(current).toContain(
    'once per logical effect type during each affected character’s own-turn cycle',
  )
  expect(current).toContain('across overlapping fields')
  expect(combatGroundAreaDescription({ durationRounds: 3 })).toContain(
    'Each cast has its own allowance.',
  )
})

it('normalizes flat and percentage recoveries to the same safe logical identity and drops unknown private types', () => {
  const current = {
    ...area,
    contactPolicyVersion: 1 as const,
    entryEffects: [
      { type: 'healing' as const, recipient: 'primary-unit' as const, amount: 20 },
      {
        type: 'percentage-recovery' as const,
        recipient: 'primary-unit' as const,
        resource: 'hp' as const,
        percent: 20,
      },
      {
        type: 'resource-change' as const,
        recipient: 'primary-unit' as const,
        resource: 'mp' as const,
        delta: 20,
      },
      {
        type: 'percentage-recovery' as const,
        recipient: 'primary-unit' as const,
        resource: 'mp' as const,
        percent: 20,
      },
      {
        type: 'apply-status' as const,
        recipient: 'primary-unit' as const,
        statusId: 'secret.unknown',
        stacks: 1,
      },
    ],
  }
  expect(projectPublicCombatGroundAreas([current], 2, 'active')[0]!.effectVisualIds).toEqual([
    'hp-recovery',
    'mp-recovery',
  ])
})

it('retains the safe preset fallback if no captured effect has a registered visual identity', () => {
  const captured = {
    ...area,
    contactPolicyVersion: 1 as const,
    entryEffects: [
      {
        type: 'apply-status' as const,
        recipient: 'primary-unit' as const,
        statusId: 'private.unknown',
        stacks: 1,
      },
    ],
  }
  expect(projectPublicCombatGroundAreas([captured], 2, 'active')).toEqual([area])
})
