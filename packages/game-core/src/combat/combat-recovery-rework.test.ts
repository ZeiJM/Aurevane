import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatEncounterState,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import {
  createPv1fTemporaryResources,
  executePv1fMovement,
  executePv1fMatureSkill,
  finishPv1fTurn,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import { latestEnabledMatureSkills } from './mature-skills'

function encounter(): StatDrivenCombatEncounterState {
  const ids = ['actor', 'target', 'enemy']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'recovery-contract',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: ids.map((id, i) => ({
        id,
        teamId: id === 'enemy' ? 'enemies' : 'players',
        initiative: 30 - i * 10,
        baseMovementBudget: 4,
        hp: 30,
        maxHp: 100,
        mp: 5,
        maxMp: 30,
        temporaryResources: createPv1fTemporaryResources(10),
      })),
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 5,
    height: 3,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: Array.from({ length: 15 }, (_, i) => ({
      position: { x: i % 5, y: Math.floor(i / 5) },
      elevation: 0,
      terrainId: 'open',
    })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
    placements: ids.map((combatantId, i) => ({
      combatantId,
      position: { x: i + 1, y: 1 },
      facing: 'east' as const,
      movementProfileId: 'ground',
    })),
  })
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical),
    ids.map((combatantId) => ({
      combatantId,
      provenance: {
        kind: 'scenario' as const,
        sourceId: 'scenario:recovery',
        sourceRulesVersion: 1,
      },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
    })),
  )
}
function action(
  effects: readonly CombatEffectDefinition[],
  id = 'test.recovery',
): CombatActionDefinition {
  return {
    id,
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    requirements: [],
    cost: { mp: 0, spendsAction: false },
    target: {
      kind: 'unit',
      teamPolicy: 'any',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'all-units',
    },
    effects,
  }
}
function recovery(kind: 'hp' | 'mp', ticks: number, amount = 8): CombatEffectDefinition {
  return (
    kind === 'hp'
      ? { type: 'healing', recipient: 'primary-unit', amount, ticks }
      : { type: 'resource-change', resource: 'mp', recipient: 'primary-unit', delta: amount, ticks }
  ) as CombatEffectDefinition
}
const selection = { kind: 'unit' as const, combatantId: 'target' }
function cast(
  state: CombatEncounterState,
  definition: CombatActionDefinition,
): StatDrivenCombatEncounterState {
  return {
    ...state,
    ...executeCombatAction(state, definition, selection, PV1F_COMBAT_CONTENT).state,
  } as StatDrivenCombatEncounterState
}
function end(state: StatDrivenCombatEncounterState): StatDrivenCombatEncounterState {
  return finishPv1fTurn(state, 'east').state
}
function value(state: CombatEncounterState, id: string, kind: 'hp' | 'mp' = 'hp') {
  return state.tactical.battle.combatants.find((row) => row.id === id)![kind]
}
function pending(state: CombatEncounterState) {
  return state.effectState?.ongoingRecovery ?? []
}
function status<T extends CombatEncounterState>(state: T, id: string, statusId: string): T {
  const definition = PV1F_COMBAT_CONTENT.statuses.find((row) => row.id === statusId)!
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === id
        ? {
            ...row,
            statuses: [
              ...row.statuses,
              {
                statusId,
                statusVersion: definition.version,
                stacks: 1,
                remainingOwnerTurnStarts: definition.durationOwnerTurnStarts,
                sourceCombatantId: 'actor',
              },
            ].sort((a, b) => a.statusId.localeCompare(b.statusId)),
          }
        : row,
    ),
  }
}

describe('Heal X and MP Rec X execution', () => {
  it.each([1, 2, 3, 4])(
    'applies exactly %i HP recovery ticks including the immediate tick',
    (ticks) => {
      let state = cast(encounter(), action([recovery('hp', ticks)]))
      expect(value(state, 'target')).toBe(38)
      expect(pending(state).length).toBe(ticks === 1 ? 0 : 1)
      if (ticks > 1) expect(pending(state)[0]?.remainingFutureTicks).toBe(ticks - 1)
      for (let turn = 0; turn < 12; turn++) state = end(state)
      expect(value(state, 'target')).toBe(30 + 8 * ticks)
      expect(pending(state)).toHaveLength(0)
    },
  )
  it.each([1, 2, 3, 4])('applies exactly %i MP recovery ticks', (ticks) => {
    let state = cast(encounter(), action([recovery('mp', ticks, 3)]))
    for (let turn = 0; turn < 12; turn++) state = end(state)
    expect(value(state, 'target', 'mp')).toBe(5 + 3 * ticks)
    expect(pending(state)).toHaveLength(0)
  })
  it('ticks only at the recipient end-turn and survives JSON save/reload', () => {
    let state = cast(encounter(), action([recovery('hp', 3)]))
    state = JSON.parse(JSON.stringify(state))
    state = end(state)
    expect(value(state, 'target')).toBe(38)
    state = end(state)
    expect(value(state, 'target')).toBe(46)
    expect(pending(state)[0]?.remainingFutureTicks).toBe(1)
  })
  it('caps each recovery at max HP/MP without discarding its later ticks', () => {
    let state = cast(encounter(), action([recovery('hp', 3, 200), recovery('mp', 3, 200)]))
    expect(value(state, 'target')).toBe(100)
    expect(value(state, 'target', 'mp')).toBe(30)
    expect(pending(state)).toHaveLength(2)
    state = cast(
      state,
      action(
        [
          { type: 'damage', recipient: 'primary-unit', amount: 10 },
          { type: 'resource-change', resource: 'mp', recipient: 'primary-unit', delta: -10 },
        ],
        'test.drain',
      ),
    )
    state = end(end(state))
    expect(value(state, 'target')).toBe(100)
    expect(value(state, 'target', 'mp')).toBe(30)
    expect(pending(state).map((row) => row.remainingFutureTicks)).toEqual([1, 1])
  })
  it('applies Hex to every HP tick using current status state, never to MP', () => {
    let state = cast(
      status(encounter(), 'target', 'hexed'),
      action([recovery('hp', 3), recovery('mp', 3)]),
    )
    expect(value(state, 'target')).toBe(36)
    state = end(end(state))
    expect(value(state, 'target')).toBe(42)
    expect(value(state, 'target', 'mp')).toBe(21)
    state = cast(
      state,
      action(
        [{ type: 'remove-status', recipient: 'primary-unit', statusIds: ['hexed'] }],
        'test.cleanse',
      ),
    )
    state = end(end(end(state)))
    expect(value(state, 'target')).toBe(50)
    expect(value(state, 'target', 'mp')).toBe(29)
  })
  it('refreshes the same action schedule while distinct actions coexist', () => {
    let state = cast(encounter(), action([recovery('hp', 3, 4)]))
    state = cast(state, action([recovery('hp', 2, 6)]))
    expect(pending(state)).toHaveLength(1)
    expect(pending(state)[0]).toMatchObject({ amountPerTick: 6, remainingFutureTicks: 1 })
    state = cast(state, action([recovery('hp', 4, 2)], 'test.second-recovery'))
    expect(pending(state)).toHaveLength(2)
    state = end(end(state))
    expect(value(state, 'target')).toBe(50)
    expect(pending(state)).toHaveLength(1)
  })
  it('a one-tick reapplication replaces, rather than keeps, its old schedule', () => {
    let state = cast(encounter(), action([recovery('hp', 4)]))
    state = cast(state, action([recovery('hp', 1)]))
    expect(pending(state)).toHaveLength(0)
  })
  it('removes scheduled HP and MP recovery on defeat and never revives', () => {
    let state = cast(encounter(), action([recovery('hp', 4), recovery('mp', 4)]))
    state = cast(
      state,
      action(
        [{ type: 'damage', recipient: 'primary-unit', amount: 200 }, recovery('hp', 3)],
        'test.defeat',
      ),
    )
    expect(value(state, 'target')).toBe(0)
    expect(pending(state)).toHaveLength(0)
    expect(value(end(state), 'target')).toBe(0)
  })
  it('a lethal legacy DoT tick is not rescued by scheduled healing', () => {
    let state = cast(encounter(), action([recovery('hp', 4), recovery('mp', 4)]))
    state = status(state, 'target', 'burn')
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((row) =>
            row.id === 'target' ? { ...row, hp: 2 } : row,
          ),
        },
      },
    }
    state = end(end(state))
    expect(value(state, 'target')).toBe(0)
    expect(pending(state)).toHaveLength(0)
  })
  it('keeps recovery separate from removable positive statuses', () => {
    let state = cast(status(encounter(), 'target', 'guarded'), action([recovery('hp', 3)]))
    state = cast(
      state,
      action(
        [{ type: 'remove-status', recipient: 'primary-unit', statusIds: ['guarded'] }],
        'test.dispel',
      ),
    )
    expect(pending(state)).toHaveLength(1)
    expect(state.statusState.find((row) => row.combatantId === 'target')?.statuses).toHaveLength(0)
  })
  it('preserves recovery through movement and leaves preview inputs untouched', () => {
    const definition = action([recovery('hp', 3)])
    const initial = encounter()
    const before = JSON.stringify(initial)
    const preview = evaluateCombatAction(initial, definition, selection, PV1F_COMBAT_CONTENT)
    expect(JSON.stringify(initial)).toBe(before)
    const committed = executeCombatAction(initial, definition, selection, PV1F_COMBAT_CONTENT)
    expect(preview.projectedEvents).toEqual(
      committed.events.filter((event) => event.event !== 'combat_action_used'),
    )
    const state = executePv1fMovement({ ...committed.state, statBridge: initial.statBridge }, [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]).state
    expect(pending(state)[0]?.remainingFutureTicks).toBe(2)
  })
  it('applies consecutive-use falloff to each tick amount, not its duration', () => {
    const base = latestEnabledMatureSkills().find((row) =>
      row.effects.some((effect) => effect.type === 'healing'),
    )!
    const definition = {
      ...base,
      id: 'test.repeat-heal',
      apCost: 25,
      mpCost: 0,
      overrides: {},
      requirements: [],
      target: action([]).target,
      effects: [recovery('hp', 3)],
    }
    let state = executePv1fMatureSkill(encounter(), definition, selection).state
    state = executePv1fMatureSkill(state, definition, selection).state
    expect(value(state, 'target')).toBe(42)
    expect(pending(state)[0]).toMatchObject({ amountPerTick: 4, remainingFutureTicks: 2 })
    state = end(end(state))
    expect(value(state, 'target')).toBe(46)
  })
  it('preserves legacy immediate recovery and Regeneration semantics', () => {
    let state = cast(
      status(encounter(), 'target', 'regeneration'),
      action([{ type: 'healing', recipient: 'primary-unit', amount: 8 }]),
    )
    expect(state.effectState).toBeUndefined()
    state = end(end(state))
    expect(value(state, 'target')).toBe(42)
    expect(pending(state)).toHaveLength(0)
  })
  it.each([0, 5, -1, 1.5, NaN, Infinity])(
    'rejects malformed duration %s at the execution boundary',
    (ticks) => {
      expect(() => cast(encounter(), action([recovery('hp', ticks)]))).toThrow(/ticks/i)
      expect(() => cast(encounter(), action([recovery('mp', ticks)]))).toThrow(/ticks/i)
    },
  )
  it('rejects a scheduled MP drain', () => {
    expect(() => cast(encounter(), action([recovery('mp', 2, -3)]))).toThrow(/drain/i)
  })
  it('validates scheduled state instead of silently discarding corrupt entries', () => {
    const state = cast(encounter(), action([recovery('hp', 3)]))
    const corrupted = {
      ...state,
      effectState: {
        ...state.effectState,
        ongoingRecovery: [{ ...pending(state)[0], remainingFutureTicks: 0 }],
      },
    } as CombatEncounterState
    expect(
      validateCombatEncounterState(corrupted).some((issue) =>
        issue.field.startsWith('effectState'),
      ),
    ).toBe(true)
  })
})

it('treats omitted recovery duration as one tick when replacing the same action', () => {
  let state = cast(encounter(), action([recovery('hp', 4)]))
  state = cast(state, action([{ type: 'healing', recipient: 'primary-unit', amount: 8 }]))
  expect(pending(state)).toHaveLength(0)
})

it('scheduled recovery survives the source defeat and still heals its living recipient', () => {
  let state = end(cast(encounter(), action([recovery('hp', 3)])))
  const defeated = executeCombatAction(
    state,
    action([{ type: 'damage', recipient: 'primary-unit', amount: 200 }], 'test.source-defeat'),
    { kind: 'unit', combatantId: 'actor' },
    PV1F_COMBAT_CONTENT,
  )
  state = { ...defeated.state, statBridge: state.statBridge }
  expect(value(state, 'actor')).toBe(0)
  state = end(state)
  expect(value(state, 'target')).toBe(46)
  expect(pending(state)[0]?.remainingFutureTicks).toBe(1)
})
