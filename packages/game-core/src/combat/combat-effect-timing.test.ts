import { describe, expect, it } from 'vitest'
import {
  pendingCombatStatusRows,
  parseCombatEffectTimingPolicy,
  parseStoredCombatEffectTimingPolicy,
} from './combat-effect-timing'
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
  validateCombatEncounterState,
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
  it('retains a delayed hit’s element through storage and round activation', () => {
    const state = encounter()
    state.effectTimingPolicy = { version: 1, modes: { damage: 'next-round' } }
    const cast = executeCombatAction(
      state,
      {
        ...action,
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 5, element: 'fire' }],
      },
      { kind: 'unit', combatantId: 'actor1' },
      content,
    )
    expect(cast.events.some((event) => event.event === 'damage_applied')).toBe(false)
    const stored = JSON.parse(JSON.stringify(cast.state)) as CombatEncounterState
    const afterFirst = end(stored)
    const activated = endCombatTurn(
      {
        ...afterFirst,
        tactical: selectCurrentFinalFacing(afterFirst.tactical, 'east').state,
      },
      content,
    )
    expect(activated.events.find((event) => event.event === 'damage_applied')).toMatchObject({
      element: 'fire',
      amount: 5,
      targetCombatantId: 'actor1',
    })
  })
  it.each(['copy', 'regeneration', 'hastened', 'delayed', 'borrowed-hour', 'summoned', 'marked'])(
    'ignores inert stored %s timing overrides without allowing new publication',
    (tag) => {
      const stored = { version: 3, modes: { [tag]: 'instant', summon: 'instant' } }
      expect(parseStoredCombatEffectTimingPolicy(stored)).toEqual({
        version: 3,
        modes: { summon: 'instant' },
      })
      expect(() => parseCombatEffectTimingPolicy(stored)).toThrow()
      expect(stored.modes[tag]).toBe('instant')
    },
  )
  it('keeps an existing battle usable when its timing metadata names retired effects', () => {
    const state = encounter()
    state.effectTimingPolicy = {
      version: 3,
      modes: { copy: 'instant', summoned: 'instant', summon: 'instant' },
    }
    expect(validateCombatEncounterState(state)).toEqual([])
    expect(
      evaluateCombatAction(state, action, { kind: 'unit', combatantId: 'actor1' }, content).legal,
    ).toBe(true)
  })
  it.each(['regeneration', 'hastened', 'delayed', 'borrowed-hour', 'summoned', 'marked'])(
    'rejects queued retired %s even with its embedded historical catalog',
    (statusId) => {
      const queued = executeCombatAction(
        encounter(),
        action,
        { kind: 'unit', combatantId: 'actor1' },
        content,
      ).state
      const pending = queued.pendingEffects![0]!
      const retired = {
        ...queued,
        pendingEffects: [
          {
            ...pending,
            effect: {
              ...pending.effect,
              type: 'apply-status' as const,
              recipient: 'primary-unit' as const,
              statusId,
              stacks: 1,
            },
            content: { statuses: [{ ...content.statuses[0]!, id: statusId }] },
          },
        ],
      }
      const before = JSON.stringify(retired)
      expect(
        validateCombatEncounterState(retired).some((issue) => issue.field === 'pendingEffects'),
      ).toBe(true)
      expect(() => end(retired)).toThrow()
      expect(JSON.stringify(retired)).toBe(before)
    },
  )
  it('keeps a one-turn debuff pending through six turns then active for its complete activation round', () => {
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
    expect(state.statusState.find((r) => r.combatantId === 'actor1')?.statuses).toHaveLength(1)
    for (let i = 0; i < 4; i++) state = end(state)
    expect(state.tactical.battle.round).toBe(3)
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
        : type === 'burn'
          ? { type: 'burn' as const, recipient: 'actor' as const, durationTurns: 1 }
          : { type: 'poison' as const, recipient: 'actor' as const, durationTurns: 1 }
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

it.each(['next-round', 'delayed'] as const)(
  'forecasts %s terrain and support lifetimes without mutating the encounter',
  (mode) => {
    const state = encounter()
    state.effectTimingPolicy = {
      version: 2,
      modes: { 'create-terrain': mode, hexed: mode, poison: mode },
    }
    const activationRound = mode === 'delayed' ? 3 : 2
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
        expect.objectContaining({ after: 'frozen', remainingRoundBoundaries: 2, activationRound }),
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
          activationRound,
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
          activationRound,
        }),
      ]),
    )
    expect(state).toEqual(before)
  },
)

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

it.each([
  ['guarded', 8500, 2, 17],
  ['lowered-guard', 25000, 1, 50],
  ['exposed', 11500, 2, 23],
] as const)(
  '%s applies its damage multiplier through the whole final round',
  (statusId, multiplier, turns, damage) => {
    const catalog = {
      statuses: [
        { ...content.statuses[0]!, id: statusId, damageTakenMultiplierBasisPoints: multiplier },
      ],
    }
    const buff = {
      ...action,
      target: { ...action.target, kind: 'self' as const, teamPolicy: 'self' as const },
      effects: [
        {
          type: 'apply-status' as const,
          recipient: 'actor' as const,
          statusId,
          stacks: 1,
          durationTurns: turns,
        },
      ],
    }
    for (const recipient of ['actor0', 'actor1']) {
      let state = encounter()
      const advance = () => {
        state = endCombatTurn(
          { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
          catalog,
        ).state
      }
      if (recipient === 'actor1') advance()
      state = executeCombatAction(state, buff, { kind: 'self' }, catalog).state
      while (state.tactical.battle.round === 1) advance()
      const attack = {
        ...action,
        effects: [{ type: 'damage' as const, recipient: 'primary-unit' as const, amount: 20 }],
      }
      for (let round = 2; round < 2 + turns; round++) {
        for (let turn = 0; turn < 2; turn++) {
          expect(state.tactical.battle.round).toBe(round)
          if (state.tactical.battle.currentTurn?.combatantId !== recipient)
            expect(
              evaluateCombatAction(state, attack, { kind: 'unit', combatantId: recipient }, catalog)
                .projectedEffects,
            ).toContainEqual(
              expect.objectContaining({ effectType: 'damage', before: 100, after: 100 - damage }),
            )
          advance()
        }
      }
      expect(state.statusState.find((row) => row.combatantId === recipient)?.statuses).toHaveLength(
        0,
      )
      if (state.tactical.battle.currentTurn?.combatantId === recipient) advance()
      expect(
        evaluateCombatAction(state, attack, { kind: 'unit', combatantId: recipient }, catalog)
          .projectedEffects,
      ).toContainEqual(expect.objectContaining({ effectType: 'damage', before: 100, after: 80 }))
    }
  },
)
