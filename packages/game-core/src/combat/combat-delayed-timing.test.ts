import { expect, it } from 'vitest'
import {
  combatEffectTimingRoundOffset,
  parseCombatEffectTimingPolicy,
} from './combat-effect-timing'
import {
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { selectCurrentFinalFacing } from './board'
const content = { statuses: [] }
function advance(state: CombatEncounterState) {
  const round = state.tactical.battle.round
  while (state.tactical.battle.round === round)
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      content,
    ).state
  return JSON.parse(JSON.stringify(state)) as CombatEncounterState
}
export const recoveryAction: CombatActionDefinition = {
  id: 'test.recovery',
  version: 1,
  sourceType: 'test',
  tags: [],
  cost: { mp: 0, spendsAction: false },
  requirements: [],
  target: {
    kind: 'self',
    teamPolicy: 'self',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 0,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'allies-only',
  },
  effects: [{ type: 'healing', recipient: 'actor', amount: 20 }],
}
it('uses one exclusive timing enum with offsets 0/1/2', () => {
  expect(
    ['instant', 'next-round', 'delayed'].map((mode) =>
      combatEffectTimingRoundOffset(mode as 'instant' | 'next-round' | 'delayed'),
    ),
  ).toEqual([0, 1, 2])
  expect(
    parseCombatEffectTimingPolicy({ version: 2, modes: { healing: 'delayed' } }).modes.healing,
  ).toBe('delayed')
  expect(() =>
    parseCombatEffectTimingPolicy({ version: 2, modes: { healing: ['instant', 'delayed'] } }),
  ).toThrow()
})
it('keeps a delayed cast pending for two global rounds through reload', () => {
  let state: CombatEncounterState = {
    ...percentageDotEncounter(),
    effectTimingPolicy: { version: 2, modes: { healing: 'delayed' } },
  }
  state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp = 500
  state = executeCombatAction(state, recoveryAction, { kind: 'self' }, content).state
  expect(state.pendingEffects![0]!.activationRound).toBe(3)
  state = advance(state)
  expect(state.tactical.battle.combatants[0]!.hp).toBe(500)
  expect(validateCombatEncounterState(state)).toEqual([])
  state = advance(state)
  expect(state.tactical.battle.combatants[0]!.hp).toBe(520)
  expect(state.pendingEffects).toHaveLength(0)
})
it('casts Rewind before moving and returns to the captured cast tile at R+2', () => {
  let state: CombatEncounterState = {
    ...percentageDotEncounter(),
    effectTimingPolicy: { version: 2, modes: { 'return-to-turn-start': 'delayed' } },
  }
  state = executeCombatAction(
    state,
    {
      ...recoveryAction,
      effects: [{ type: 'return-to-turn-start', recipient: 'actor', anchorMode: 'cast-position' }],
    },
    { kind: 'self' },
    content,
  ).state
  expect(state.pendingEffects![0]!.returnAnchor).toEqual({ x: 1, y: 1 })
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements.map((row) =>
        row.combatantId === 'actor' ? { ...row, position: { x: 0, y: 0 } } : row,
      ),
    },
  }
  state = advance(advance(state))
  expect(state.tactical.placements.find((row) => row.combatantId === 'actor')!.position).toEqual({
    x: 1,
    y: 1,
  })
})

it.each(['occupied', 'rooted', 'impassable', 'elevation'] as const)(
  'records a blocked cast-position return: %s',
  (reason) => {
    let state: CombatEncounterState = {
      ...percentageDotEncounter(),
      effectTimingPolicy: { version: 2, modes: { 'return-to-turn-start': 'delayed' } },
      statBalancePolicyVersion: 1,
    }
    state.statBridge = {
      ...state.statBridge!,
      schemaVersion: 4,
      rulesVersion: 4,
      combatants: state.statBridge!.combatants.map((p) => ({
        ...p,
        level: 1,
        criticalChance: 0,
        statusResistance: 0,
      })),
    }
    const statuses =
      reason === 'rooted'
        ? [
            {
              id: 'test.root',
              version: 1,
              maximumStacks: 1,
              durationOwnerTurnStarts: 10,
              damageTakenMultiplierBasisPoints: 10000,
              movement: { blocked: true },
            },
          ]
        : []
    const catalog = { statuses }
    state = executeCombatAction(
      state,
      {
        ...recoveryAction,
        effects: [
          { type: 'return-to-turn-start', recipient: 'actor', anchorMode: 'cast-position' },
        ],
      },
      { kind: 'self' },
      catalog,
    ).state
    state.tactical.placements = state.tactical.placements.map((p) =>
      p.combatantId === 'actor'
        ? { ...p, position: { x: 0, y: 0 } }
        : reason === 'occupied' && p.combatantId === 'enemy'
          ? { ...p, position: { x: 1, y: 1 } }
          : p,
    )
    if (reason === 'rooted')
      state.statusState = state.statusState.map((r) =>
        r.combatantId === 'actor'
          ? {
              ...r,
              statuses: [
                {
                  statusId: 'test.root',
                  statusVersion: 1,
                  stacks: 1,
                  sourceCombatantId: 'enemy',
                  remainingOwnerTurnStarts: 10,
                },
              ],
            }
          : r,
      )
    if (reason === 'impassable') {
      state.tactical.terrains = [{ id: 'blocked', traversalCost: null }, ...state.tactical.terrains]
      state.tactical.tiles = state.tactical.tiles.map((t) =>
        t.position.x === 1 && t.position.y === 1 ? { ...t, terrainId: 'blocked' } : t,
      )
    }
    if (reason === 'elevation')
      state.tactical.tiles = state.tactical.tiles.map((t) =>
        t.position.x === 1 && t.position.y === 1 ? { ...t, elevation: 1 } : t,
      )
    const events: unknown[] = []
    while (state.tactical.battle.round < 3) {
      const result = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        catalog,
      )
      state = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
      events.push(...result.events)
    }
    expect(state.tactical.placements.find((p) => p.combatantId === 'actor')!.position).toEqual({
      x: 0,
      y: 0,
    })
    expect(events).toContainEqual(
      expect.objectContaining({ event: 'combatant_rewind_blocked', reason }),
    )
    expect(state.pendingEffects).toHaveLength(0)
  },
)
it('treats already being at the cast anchor as a successful no-op, without refunding resources', () => {
  let state: CombatEncounterState = {
    ...percentageDotEncounter(),
    effectTimingPolicy: { version: 2, modes: { 'return-to-turn-start': 'delayed' } },
  }
  state = executeCombatAction(
    state,
    {
      ...recoveryAction,
      cost: { mp: 3, spendsAction: false },
      effects: [{ type: 'return-to-turn-start', recipient: 'actor', anchorMode: 'cast-position' }],
    },
    { kind: 'self' },
    content,
  ).state
  state = advance(advance(state))
  expect(state.tactical.placements.find((p) => p.combatantId === 'actor')!.position).toEqual({
    x: 1,
    y: 1,
  })
  expect(state.tactical.battle.combatants.find((p) => p.id === 'actor')!.mp).toBe(17)
  expect(validateCombatEncounterState(state)).toEqual([])
})

it('rejects missing or off-board cast-position anchors after reload', () => {
  const state: CombatEncounterState = {
    ...percentageDotEncounter(),
    effectTimingPolicy: { version: 2, modes: { 'return-to-turn-start': 'delayed' } },
  }
  const cast = executeCombatAction(
    state,
    {
      ...recoveryAction,
      effects: [{ type: 'return-to-turn-start', recipient: 'actor', anchorMode: 'cast-position' }],
    },
    { kind: 'self' },
    content,
  ).state
  const missing = JSON.parse(JSON.stringify(cast)) as CombatEncounterState
  delete missing.pendingEffects![0]!.returnAnchor
  expect(validateCombatEncounterState(missing)).toContainEqual(
    expect.objectContaining({ field: 'pendingEffects' }),
  )
  const outside = JSON.parse(JSON.stringify(cast)) as CombatEncounterState
  outside.pendingEffects![0]!.returnAnchor = { x: 999, y: 999 }
  expect(validateCombatEncounterState(outside)).toContainEqual(
    expect.objectContaining({ field: 'pendingEffects' }),
  )
})
