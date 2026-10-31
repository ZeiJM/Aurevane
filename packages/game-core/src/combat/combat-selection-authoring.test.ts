import { selectCurrentFinalFacing } from './board'
import { applyCombatEndure } from './combat-endure'
import { expect, it } from 'vitest'
import {
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatEncounterState,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'
import { createAuthorableEffectPayload } from './combat-effect-authoring'
import {
  nativeCombatTagPayload,
  validateCombatTagPayload,
  type CombatTagPayload,
} from './combat-tag-registry'
import { planCombatStatusCopies, type CombatStatusCopyEffect } from './combat-status-copy'
import { validateCombatActionDefinition } from './combat-authoring-validation'

const target = { kind: 'unit' as const, combatantId: 'enemy' }
function action(effect: CombatEffectDefinition): CombatActionDefinition {
  return {
    id: 'test.selection',
    version: 1,
    sourceType: 'discipline-skill',
    tags: [],
    cost: { mp: 0, spendsAction: false },
    requirements: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      friendlyFire: 'enemies-only',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    effects: [effect],
  }
}
it('new Cleanse clears every negative status while leaving buffs and neutral effects', () => {
  let state: CombatEncounterState = percentageDotEncounter()
  state.statusState = state.statusState.map((row) =>
    row.combatantId !== 'enemy'
      ? row
      : {
          ...row,
          statuses: PV1F_COMBAT_CONTENT.statuses
            .filter(
              (definition) =>
                !['burn', 'poison', 'bleed', 'invisible', 'endure'].includes(definition.id),
            )
            .sort((a, b) => (a.id < b.id ? -1 : 1))
            .map((definition) => ({
              statusId: definition.id,
              statusVersion: definition.version,
              stacks: 1,
              remainingOwnerTurnStarts: 1,
              sourceCombatantId: 'actor',
              ...(definition.id === 'counter'
                ? { counter: { kind: 'full' as const, basisPoints: 10000 } }
                : {}),
              ...(definition.id === 'mark' ? { sourceScopedMark: true as const } : {}),
              ...(definition.id === 'suppress'
                ? {
                    potencyBasisPoints: 2500,
                    remainingOwnerTurnEnds: 1,
                    timingState: 'active' as const,
                  }
                : {}),
            })),
        },
  )
  // Endure needs its real release profile and private application ledger.
  state = applyCombatEndure(
    state,
    'enemy',
    'test.endure',
    {
      type: 'endure',
      recipient: 'actor',
      durationTurns: 2,
      releaseBasisPoints: 15000,
      radiusTiles: 1,
      targetTeams: 'enemies',
    },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(validateCombatEncounterState(state)).toEqual([])
  const statusesBefore = state.statusState.find((row) => row.combatantId === 'enemy')!.statuses
  const negative = (id: string) =>
    PV1F_COMBAT_CONTENT.statuses.find((definition) => definition.id === id)!.polarity === 'negative'
  const expectedKept = statusesBefore
    .filter((status) => !negative(status.statusId))
    .map((status) => status.statusId)
    .sort()
  const payload = createAuthorableEffectPayload('cleanse')!
  const result = executeCombatAction(
    state,
    action(nativeCombatTagPayload(payload)),
    target,
    PV1F_COMBAT_CONTENT,
  )
  const remaining = result.state.statusState
    .find((row) => row.combatantId === 'enemy')!
    .statuses.map((status) => status.statusId)
  expect(remaining).not.toContain('revealed')
  expect(remaining).not.toContain('lowered-guard')
  expect(remaining).not.toContain('hexed')
  expect(remaining).not.toContain('wet')
  for (const status of statusesBefore.filter((status) => negative(status.statusId)))
    expect(remaining, status.statusId).not.toContain(status.statusId)
  expect(remaining.sort()).toEqual(expectedKept)
  expect(remaining).toContain('endure')
  expect(result.state.endureState).toEqual(state.endureState)
  expect(validateCombatEncounterState(result.state)).toEqual([])
  expect(result.events).toContainEqual(
    expect.objectContaining({ event: 'status_removed', statusId: 'revealed' }),
  )
})
it('selected Copy Debuffs copies only selected eligible active statuses', () => {
  const state = percentageDotEncounter()
  state.statusState = state.statusState.map((row) =>
    row.combatantId !== 'actor'
      ? row
      : {
          ...row,
          statuses: ['slow', 'root', 'revealed'].map((statusId) => ({
            statusId,
            statusVersion: 1,
            stacks: 1,
            remainingOwnerTurnStarts: 1,
            sourceCombatantId: 'enemy',
          })),
        },
  )
  const effect = {
    type: 'copy-statuses',
    recipient: 'primary-unit',
    mode: 'curse',
    statusIds: ['slow'],
  } as CombatStatusCopyEffect
  const plan = planCombatStatusCopies(state, 'actor', 'enemy', effect, PV1F_COMBAT_CONTENT)
  expect(plan.copies.map((row) => row.next.statusId)).toEqual(['slow'])
})
it.each([
  ['curse', ['guarded']],
  ['amplify', ['slow']],
  ['curse', ['revealed']],
  ['curse', []],
  ['curse', ['slow', 'slow']],
] as const)('rejects ineligible or malformed %s Copy selection %j', (mode, statusIds) => {
  const effect = {
    type: 'copy-statuses',
    recipient: 'primary-unit',
    mode,
    statusIds,
  } as CombatStatusCopyEffect
  expect(() => validateCombatActionDefinition(action(effect), PV1F_COMBAT_CONTENT)).toThrow()
  expect(validateCombatTagPayload(effect).length).toBeGreaterThan(0)
})
it('new MP Drain uses recipient maximum MP and keeps historical flat drains unchanged', () => {
  const state = percentageDotEncounter()
  state.tactical.battle.combatants = state.tactical.battle.combatants.map((row) =>
    row.id === 'enemy' ? { ...row, mp: 31, maxMp: 150 } : row,
  )
  const payload = createAuthorableEffectPayload('mp-drain') as Extract<
    CombatTagPayload,
    { type: 'resource-change' }
  >
  const percent = { ...payload, delta: -20 }
  expect(validateCombatTagPayload(percent)).toEqual([])
  const result = executeCombatAction(
    state,
    action(nativeCombatTagPayload(percent)),
    target,
    PV1F_COMBAT_CONTENT,
  )
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.mp).toBe(1)
  const historical = executeCombatAction(
    state,
    action({ type: 'resource-change', recipient: 'primary-unit', resource: 'mp', delta: -20 }),
    target,
    PV1F_COMBAT_CONTENT,
  )
  expect(historical.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.mp).toBe(11)
})
it('selected DoT copy narrows independent Poison, Burn and Bleed applications without changing donors', () => {
  let state = {
    ...percentageDotEncounter(),
    effectTimingPolicy: {
      version: 8,
      modes: {
        poison: 'instant' as const,
        burn: 'instant' as const,
        bleed: 'instant' as const,
        'remove-status': 'instant' as const,
      },
    },
  }
  for (const effect of [
    { type: 'poison', recipient: 'actor', durationTurns: 4, power: 3, curseCopyable: true },
    { type: 'burn', recipient: 'actor', durationTurns: 3, power: 5, curseCopyable: true },
    {
      type: 'bleed',
      recipient: 'actor',
      ticks: 3,
      durationTurns: 3,
      damagePerTick: 4,
      curseCopyable: true,
    },
  ] as CombatEffectDefinition[])
    state = executeCombatAction(state, action(effect), target, PV1F_COMBAT_CONTENT)
      .state as typeof state
  const before = JSON.stringify(state.effectState)
  const plan = planCombatStatusCopies(
    state,
    'actor',
    'enemy',
    { type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse', statusIds: ['poison'] },
    PV1F_COMBAT_CONTENT,
  )
  expect(plan.poisons).toHaveLength(1)
  expect(plan.burns).toHaveLength(0)
  expect(plan.bleed).toHaveLength(0)
  expect(JSON.stringify(state.effectState)).toBe(before)
  const result = executeCombatAction(
    state,
    action(nativeCombatTagPayload(createAuthorableEffectPayload('cleanse')!)),
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  )
  expect(
    result.state.effectState!.poison.filter((row) => row.targetCombatantId === 'actor'),
  ).toHaveLength(1)
  const selfCleanse = {
    ...nativeCombatTagPayload(createAuthorableEffectPayload('cleanse')!),
    recipient: 'actor' as const,
  } as CombatEffectDefinition
  const cleared = executeCombatAction(state, action(selfCleanse), target, PV1F_COMBAT_CONTENT)
  expect(cleared.state.effectState!.poison).toEqual([])
  expect(cleared.state.effectState!.burn).toEqual([])
  expect(cleared.state.effectState!.bleed).toEqual([])
})
it('delayed MP Drain captures maximum MP before activation and survives JSON restore', () => {
  const state = {
    ...percentageDotEncounter(),
    effectTimingPolicy: { version: 2, modes: { 'mp-drain': 'delayed' as const } },
  }
  state.tactical.battle.combatants = state.tactical.battle.combatants.map((row) =>
    row.id === 'enemy' ? { ...row, mp: 31, maxMp: 150 } : row,
  )
  const effect = nativeCombatTagPayload(createAuthorableEffectPayload('mp-drain')!)
  if (effect.type !== 'resource-change') throw new Error('Expected MP Drain')
  const cast = executeCombatAction(
    state,
    action({ ...effect, delta: -20 }),
    target,
    PV1F_COMBAT_CONTENT,
  )
  const pending = cast.state.pendingEffects![0]!
  expect(pending.percentageRecoveryByRecipient!.enemy).toMatchObject({
    maximumAtCast: 150,
    amountPerApplication: 30,
    percent: 20,
  })
  let restored = JSON.parse(JSON.stringify(cast.state)) as typeof cast.state
  expect(validateCombatEncounterState(restored)).toEqual([])
  restored.tactical.battle.combatants = restored.tactical.battle.combatants.map((row) =>
    row.id === 'enemy' ? { ...row, maxMp: 300 } : row,
  )
  for (let turn = 0; turn < 8 && (restored.pendingEffects?.length ?? 0) > 0; turn++)
    restored = endCombatTurn(
      { ...restored, tactical: selectCurrentFinalFacing(restored.tactical, 'east').state },
      PV1F_COMBAT_CONTENT,
    ).state
  expect(restored.pendingEffects ?? []).toEqual([])
  expect(restored.tactical.battle.combatants.find((row) => row.id === 'enemy')!.mp).toBe(1)
})
it.each([0, 1, 19, 100] as const)('percentage MP Drain clamps at zero for current MP %i', (mp) => {
  const state = percentageDotEncounter()
  state.tactical.battle.combatants = state.tactical.battle.combatants.map((row) =>
    row.id === 'enemy' ? { ...row, mp, maxMp: 100 } : row,
  )
  const effect = {
    type: 'resource-change',
    recipient: 'primary-unit',
    resource: 'mp',
    delta: -100,
    basis: 'maximum-mp-percent',
    ticks: 1,
  } as CombatEffectDefinition
  const result = executeCombatAction(state, action(effect), target, PV1F_COMBAT_CONTENT)
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.mp).toBe(0)
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.mp).toBe(20)
})
