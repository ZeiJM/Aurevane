import { describe, expect, it } from 'vitest'
import { pendingCombatStatusRows } from './combat-effect-timing'
import { createPendingBattle, startBattle } from './battle-state'
import {
  createTacticalBattleState,
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  selectCurrentFinalFacing,
} from './board'
import {
  createCombatEncounterState,
  executeCombatAction,
  evaluateCombatAction,
  endCombatTurn,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'

const content = {
  statuses: [
    {
      id: 'hexed',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 1,
      damageTakenMultiplierBasisPoints: 15000,
    },
  ],
}
const policy = { version: 1, modes: {} } as const
function encounter(count = 2): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'timing',
      rulesVersion: 3,
      contentVersion: 2,
      rngSeed: 123,
      combatants: Array.from({ length: count }, (_, i) => ({
        id: `actor${i}`,
        teamId: i === 0 ? 'a' : 'b',
        initiative: count - i,
        baseMovementBudget: 2,
        hp: 100,
        maxHp: 100,
        mp: 20,
        maxMp: 30,
      })),
    }),
  ).state
  return {
    ...createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: count,
        height: 1,
        tiles: Array.from({ length: count }, (_, x) => ({
          position: { x, y: 0 },
          elevation: 0,
          terrainId: 'open-ground',
        })),
        terrains: P2_2_VERTICAL_SLICE_TERRAINS,
        movementProfiles: [P2_2_ORDINARY_GROUND_PROFILE],
        placements: Array.from({ length: count }, (_, x) => ({
          combatantId: `actor${x}`,
          position: { x, y: 0 },
          facing: 'east' as const,
          movementProfileId: 'ordinary-ground',
        })),
      }),
    ),
    effectTimingPolicy: policy,
  } as CombatEncounterState
}
const action: CombatActionDefinition = {
  id: 'hex',
  version: 1,
  sourceType: 'test',
  tags: [],
  target: {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 6,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'enemies-only',
  },
  cost: { spendsAction: false, mp: 0 },
  requirements: [],
  effects: [
    {
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'hexed',
      stacks: 1,
      durationTurns: 1,
    },
  ],
}
function end(state: CombatEncounterState) {
  return endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
    content,
  ).state
}
describe('pinned next global round effect timing', () => {
  it('keeps a one-turn debuff pending through six turns then active for its full affected turn', () => {
    let state = executeCombatAction(
      encounter(6),
      action,
      { kind: 'unit', combatantId: 'actor1' },
      content,
    ).state
    expect(state.statusState.find((r) => r.combatantId === 'actor1')?.statuses).toHaveLength(0)
    expect(
      (state as CombatEncounterState & { pendingEffects: unknown[] }).pendingEffects,
    ).toHaveLength(1)
    for (let i = 0; i < 5; i++) {
      state = end(state)
      expect(state.statusState.find((r) => r.combatantId === 'actor1')?.statuses).toHaveLength(0)
    }
    state = end(state)
    expect(state.tactical.battle.round).toBe(2)
    expect(state.statusState.find((r) => r.combatantId === 'actor1')?.statuses).toHaveLength(1)
    state = end(state)
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('actor1')
    expect(state.statusState.find((r) => r.combatantId === 'actor1')?.statuses).toHaveLength(1)
    state = end(state)
    expect(state.statusState.find((r) => r.combatantId === 'actor1')?.statuses).toHaveLength(0)
  })
  it('keeps damage and HP/MP recovery immediate while barrier and MP drain wait', () => {
    const state = executeCombatAction(
      encounter(),
      {
        ...action,
        effects: [
          { type: 'damage', recipient: 'primary-unit', amount: 10 },
          { type: 'healing', recipient: 'actor', amount: 5 },
          { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 5 },
          { type: 'resource-change', recipient: 'primary-unit', resource: 'mp', delta: -5 },
          { type: 'barrier-change', recipient: 'actor', amount: 10 },
        ],
      },
      { kind: 'unit', combatantId: 'actor1' },
      content,
    ).state
    expect(state.tactical.battle.combatants[1]?.hp).toBe(90)
    expect(state.tactical.battle.combatants[0]?.mp).toBe(25)
    expect(state.tactical.battle.combatants[1]?.mp).toBe(20)
    expect(state.effectState?.barriers ?? []).toHaveLength(0)
  })
  it('preserves instant historical battles without a pinned policy', () => {
    const initial = encounter()
    delete (initial as CombatEncounterState & { effectTimingPolicy?: unknown }).effectTimingPolicy
    expect(
      executeCombatAction(initial, action, { kind: 'unit', combatantId: 'actor1' }, content).state
        .statusState[1]?.statuses,
    ).toHaveLength(1)
  })
})

it('rejects malformed persisted timing policies and unknown delayed recipients', async () => {
  const { validateCombatEncounterState } = await import('./actions')
  expect(
    validateCombatEncounterState({
      ...encounter(),
      effectTimingPolicy: { version: 1, modes: { invented: 'instant' } },
    }),
  ).not.toEqual([])
  const queued = executeCombatAction(
    encounter(),
    action,
    { kind: 'unit', combatantId: 'actor1' },
    content,
  ).state
  const pending = queued.pendingEffects![0]!
  expect(
    validateCombatEncounterState({
      ...queued,
      pendingEffects: [{ ...pending, recipientIds: ['unknown'] }],
    }),
  ).not.toEqual([])
})

it('a delayed poison cannot tick before the global round boundary', () => {
  let state = executeCombatAction(
    encounter(),
    {
      ...action,
      effects: [{ type: 'poison', recipient: 'primary-unit', durationTurns: 1, power: 5 }],
    },
    { kind: 'unit', combatantId: 'actor1' },
    content,
  ).state
  state = end(state)
  state = end(state)
  expect(state.tactical.battle.combatants[1]?.hp).toBe(100)
  state = end(state)
  state = end(state)
  expect(state.tactical.battle.combatants[1]?.hp).toBe(95)
})
it('Master can pin an instant status without changing another battle policy', () => {
  const first = encounter()
  const instant = {
    ...encounter(),
    effectTimingPolicy: { version: 2, modes: { hexed: 'instant' as const } },
  }
  const result = executeCombatAction(
    instant,
    action,
    { kind: 'unit', combatantId: 'actor1' },
    content,
  ).state
  expect(result.statusState[1]?.statuses[0]?.remainingOwnerTurnEnds).toBe(1)
  expect(
    executeCombatAction(first, action, { kind: 'unit', combatantId: 'actor1' }, content).state
      .statusState[1]?.statuses,
  ).toHaveLength(0)
})
it('records pinned origin on pending and activated receipts', () => {
  const origin = { family: 'resonance' as const, contentId: 'res.test', contentVersion: 4 }
  let transition = executeCombatAction(
    encounter(),
    { ...action, effectOrigins: [origin] },
    { kind: 'unit', combatantId: 'actor1' },
    content,
  )
  expect(transition.events.find((event) => event.event === 'effect_pending')).toMatchObject({
    effectOrigin: origin,
  })
  const state = end(transition.state)
  transition = endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
    content,
  )
  expect(transition.events.find((event) => event.event === 'status_applied')).toMatchObject({
    effectOrigin: origin,
  })
})
it('applies queued initiative modifiers at the first following round', () => {
  const tempoContent = {
    statuses: [{ ...content.statuses[0]!, id: 'haste', nextRoundInitiative: 40 }],
  }
  let state = executeCombatAction(
    encounter(),
    {
      ...action,
      effects: [{ type: 'apply-status', recipient: 'primary-unit', statusId: 'haste', stacks: 1 }],
    },
    { kind: 'unit', combatantId: 'actor1' },
    tempoContent,
  ).state
  state = endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
    tempoContent,
  ).state
  state = endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
    tempoContent,
  ).state
  expect(state.tactical.battle.round).toBe(2)
  expect(state.tactical.battle.currentTurn?.combatantId).toBe('actor1')
})
it('instant self debuffs keep their next full affected turn after the application turn', () => {
  let state = executeCombatAction(
    { ...encounter(), effectTimingPolicy: { version: 2, modes: { hexed: 'instant' } } },
    {
      ...action,
      target: { ...action.target, kind: 'self', teamPolicy: 'self', friendlyFire: 'all-units' },
      effects: [
        {
          type: 'apply-status',
          recipient: 'actor',
          statusId: 'hexed',
          stacks: 1,
          durationTurns: 1,
        },
      ],
    },
    { kind: 'self' },
    content,
  ).state
  state = end(state)
  expect(state.statusState[0]?.statuses).toHaveLength(1)
  state = end(state)
  expect(state.statusState[0]?.statuses).toHaveLength(1)
  state = end(state)
  expect(state.statusState[0]?.statuses).toHaveLength(0)
})

it('advances or completes safely when next-round damage defeats the newly selected actor', () => {
  for (const count of [2, 6]) {
    let state = encounter(count)
    state.effectTimingPolicy = { version: 1, modes: { damage: 'next-round' } }
    for (let index = 0; index < count - 1; index++) state = end(state)
    state = executeCombatAction(
      state,
      { ...action, effects: [{ type: 'damage', recipient: 'primary-unit', amount: 100 }] },
      { kind: 'unit', combatantId: 'actor0' },
      content,
    ).state
    const result = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
      content,
    )
    expect(result.state.tactical.battle.combatants.find((row) => row.id === 'actor0')?.hp).toBe(0)
    expect(result.state.tactical.battle.currentTurn?.combatantId).not.toBe('actor0')
    expect(result.state.pendingEffects).toEqual([])
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', targetCombatantId: 'actor0', hpAfter: 0 }),
    )
  }
})

it('blocks delayed Covert while Revealed remains active at activation', () => {
  let state = encounter()
  state.statusState = state.statusState.map((row) =>
    row.combatantId === 'actor0'
      ? {
          ...row,
          statuses: [
            {
              statusId: 'revealed',
              statusVersion: 1,
              stacks: 1,
              remainingOwnerTurnStarts: 4,
              sourceCombatantId: 'actor1',
            },
          ],
        }
      : row,
  )
  const csrContent = {
    statuses: ['covert', 'revealed'].map((id) => ({
      id,
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 4,
      damageTakenMultiplierBasisPoints: 10000,
    })),
  }
  state = executeCombatAction(
    state,
    {
      ...action,
      target: { ...action.target, kind: 'self', teamPolicy: 'self', friendlyFire: 'all-units' },
      effects: [
        {
          type: 'apply-status',
          recipient: 'actor',
          statusId: 'covert',
          stacks: 1,
          durationTurns: 2,
        },
      ],
    },
    { kind: 'self' },
    csrContent,
  ).state
  for (let i = 0; i < 2; i++)
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
      csrContent,
    ).state
  expect(state.statusState[0]?.statuses.some((status) => status.statusId === 'revealed')).toBe(true)
  expect(state.statusState[0]?.statuses.some((status) => status.statusId === 'covert')).toBe(false)
})
it('resolves delayed damage reactions with its original out-of-turn source and activation-round history', () => {
  let state = end(encounter())
  const reactionContent = {
    statuses: [
      ...content.statuses,
      {
        id: 'test.reaction',
        version: 1,
        maximumStacks: 1,
        durationOwnerTurnStarts: 4,
        damageTakenMultiplierBasisPoints: 10000,
        polarity: 'positive' as const,
        reactionClass: 'reactive' as const,
        absorbHpBasisPoints: 5000,
        reflectBasisPoints: 5000,
      },
    ],
  }
  state.statusState = state.statusState.map((row) =>
    row.combatantId === 'actor0'
      ? {
          ...row,
          statuses: [
            {
              statusId: 'test.reaction',
              statusVersion: 1,
              stacks: 1,
              remainingOwnerTurnStarts: 4,
              sourceCombatantId: 'actor0',
            },
          ],
        }
      : row,
  )
  state.effectTimingPolicy = { version: 1, modes: { damage: 'next-round' } }
  state = executeCombatAction(
    state,
    { ...action, effects: [{ type: 'damage', recipient: 'primary-unit', amount: 30 }] },
    { kind: 'unit', combatantId: 'actor0' },
    reactionContent,
  ).state
  state = endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
    reactionContent,
  ).state
  expect(state.tactical.battle.combatants.find((row) => row.id === 'actor0')?.hp).toBe(85)
  expect(state.tactical.battle.combatants.find((row) => row.id === 'actor1')?.hp).toBe(85)
  expect(state.effectState?.damageHistory).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ combatantId: 'actor0', round: 2, amount: 30 }),
    ]),
  )
})
it('preserves the critical result rolled at cast for delayed damage', () => {
  let state = encounter()
  state.effectTimingPolicy = { version: 1, modes: { damage: 'next-round' } }
  state.statBridge = {
    rulesVersion: 4,
    combatants: state.tactical.battle.combatants.map((unit) => ({
      combatantId: unit.id,
      armor: 0,
      ward: 0,
      level: 1,
      criticalChance: 10000,
    })),
  }
  const cast = executeCombatAction(
    state,
    { ...action, effects: [{ type: 'damage', recipient: 'primary-unit', amount: 10 }] },
    { kind: 'unit', combatantId: 'actor1' },
    content,
  )
  expect(cast.events).toContainEqual(
    expect.objectContaining({ event: 'combat_critical_resolved', critical: true }),
  )
  expect(cast.state.pendingEffects?.[0]?.criticalRecipientIds).toEqual(['actor1'])
  state = end(end(cast.state))
  expect(state.tactical.battle.combatants.find((row) => row.id === 'actor1')?.hp).toBe(85)
})

it('keeps instant self DOTs for their next full affected turn', () => {
  for (const type of ['poison', 'burn', 'bleed'] as const) {
    let state = encounter()
    state.effectTimingPolicy = { version: 1, modes: { [type]: 'instant' } }
    const effect =
      type === 'bleed'
        ? { type, recipient: 'actor' as const, damagePerTick: 2, ticks: 1 }
        : { type, recipient: 'actor' as const, durationTurns: 1 }
    state = executeCombatAction(
      state,
      {
        ...action,
        target: { ...action.target, kind: 'self', teamPolicy: 'self', friendlyFire: 'all-units' },
        effects: [effect],
      },
      { kind: 'self' },
      content,
    ).state
    state = end(state)
    expect(state.effectState?.[type]).toHaveLength(1)
    expect(state.tactical.battle.combatants.find((row) => row.id === 'actor0')?.hp).toBe(100)
    state = end(end(state))
    expect(state.effectState?.[type]).toHaveLength(0)
    expect(state.tactical.battle.combatants.find((row) => row.id === 'actor0')?.hp).toBeLessThan(
      100,
    )
  }
})

it('persists and reloads delayed tile effects with ground-target validation', () => {
  let state = executeCombatAction(
    encounter(),
    {
      ...action,
      target: {
        ...action.target,
        kind: 'ground-tile',
        teamPolicy: 'any',
        friendlyFire: 'all-units',
      },
      effects: [{ type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' }],
    },
    { kind: 'tile', position: { x: 1, y: 0 } },
    content,
  ).state
  state = JSON.parse(JSON.stringify(state)) as CombatEncounterState
  expect(state.pendingEffects).toHaveLength(1)
  expect(state.terrainOverlays ?? []).toHaveLength(0)
  state = end(end(state))
  expect(state.pendingEffects).toEqual([])
  expect(state.terrainOverlays).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'frozen', remainingRoundBoundaries: 2 }),
    ]),
  )
})

it('forecasts delayed terrain and support lifetimes without changing the encounter or inventing active receipts', () => {
  const state = encounter()
  const before = JSON.parse(JSON.stringify(state))
  const terrain = evaluateCombatAction(
    state,
    {
      ...action,
      target: {
        ...action.target,
        kind: 'ground-tile',
        teamPolicy: 'any',
        friendlyFire: 'all-units',
      },
      effects: [{ type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' }],
    },
    { kind: 'tile', position: { x: 1, y: 0 } },
    content,
  )
  expect(terrain.projectedTerrain).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ after: 'frozen', remainingRoundBoundaries: 2, activationRound: 2 }),
    ]),
  )
  expect(terrain.projectedEvents.some((event) => event.event === 'terrain_overlay_changed')).toBe(
    false,
  )
  const support = evaluateCombatAction(
    state,
    action,
    { kind: 'unit', combatantId: 'actor1' },
    content,
  )
  expect(support.projectedEffects).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        after: 'pending',
        statusId: 'hexed',
        remainingOwnerTurnEnds: 1,
        activationRound: 2,
      }),
    ]),
  )
  expect(support.projectedEvents.some((event) => event.event === 'status_applied')).toBe(false)
  const poison = evaluateCombatAction(
    state,
    { ...action, effects: [{ type: 'poison', recipient: 'primary-unit' }] },
    { kind: 'unit', combatantId: 'actor1' },
    content,
  )
  expect(poison.projectedEffects).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        after: 'pending',
        statusId: 'poison',
        durationScope: 'until-removed',
        activationRound: 2,
      }),
    ]),
  )
  expect(state).toEqual(before)
})

it('retains authored status potency in the pending icon projection', () => {
  const cast = executeCombatAction(
    encounter(),
    {
      ...action,
      effects: [
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'hexed',
          stacks: 1,
          potencyBasisPoints: 2500,
        },
      ],
    },
    { kind: 'unit', combatantId: 'actor1' },
    content,
  )
  expect(pendingCombatStatusRows(cast.state)[0]?.status.potencyBasisPoints).toBe(2500)
})
