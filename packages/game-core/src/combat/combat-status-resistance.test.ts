import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatEffectDefinition,
} from './actions'
import { advanceBattleRng, createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import { normalizeCombatEffectState } from './combat-effect-state'
import { createCombatActionProvenance, createCombatTriggerGuard } from './combat-kernel-types'
import { projectedCombatEffectUtility } from './recruit-ai-build'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'
import {
  createCovertStatusDefinition,
  createRevealedStatusDefinition,
} from './covert-sensory-revealed'
import { createStatBalancedCombatEncounterState } from './stat-driven-combat'

const CONTENT: CombatContentCatalog = {
  statuses: [
    {
      id: 'displaced',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 1,
      damageTakenMultiplierBasisPoints: 10000,
      polarity: 'neutral',
    },
    {
      id: 'root',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      damageTakenMultiplierBasisPoints: 10000,
      polarity: 'negative',
      reactionClass: 'ordinary',
      movement: { blocked: true },
    },
    {
      id: 'test.debuff',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      damageTakenMultiplierBasisPoints: 10000,
      polarity: 'negative',
      reactionClass: 'ordinary',
      curseCopyable: true,
    },
    {
      id: 'test.buff',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      damageTakenMultiplierBasisPoints: 10000,
      polarity: 'positive',
      reactionClass: 'ordinary',
    },
  ],
}
const SELECT = { kind: 'unit' as const, combatantId: 'target' }
function world(resistance = 1500, seed = 1): CombatEncounterState {
  const ids = ['actor', 'target', 'other']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'resistance',
      rulesVersion: 4,
      contentVersion: 1,
      rngSeed: seed,
      combatants: ids.map((id, index) => ({
        id,
        teamId: index === 0 ? 'players' : 'enemies',
        initiative: 30 - index * 10,
        baseMovementBudget: 3,
        hp: 100,
        maxHp: 100,
        mp: 20,
        maxMp: 20,
      })),
    }),
  ).state
  const base = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 3,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: ids.map((_, x) => ({ position: { x, y: 0 }, terrainId: 'open', elevation: 0 })),
      movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
      placements: ids.map((combatantId, x) => ({
        combatantId,
        position: { x, y: 0 },
        facing: 'east',
        movementProfileId: 'ground',
      })),
    }),
  )
  return createStatBalancedCombatEncounterState(
    base,
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario', sourceId: combatantId, sourceRulesVersion: 4 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
      physicalPower: 0,
      mysticPower: 0,
      level: 1,
      criticalChance: 0,
      statusResistance: resistance,
    })),
  )
}
function resistingWorld(): CombatEncounterState {
  for (let seed = 1; seed < 1000; seed++) {
    const state = world(1500, seed)
    if (advanceBattleRng(state.tactical.battle.rng).value % 10000 < 1500) return state
  }
  throw new Error('No resisting test seed')
}
function action(
  effects: readonly CombatEffectDefinition[] = [
    { type: 'damage', recipient: 'primary-unit', amount: 20 },
    { type: 'apply-status', recipient: 'primary-unit', statusId: 'test.debuff', stacks: 1 },
  ],
): CombatActionDefinition {
  return {
    id: 'ordinary.skill',
    version: 1,
    sourceType: 'discipline-skill',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 3,
      requiresLineOfSight: false,
      maximumElevationDifference: 0,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: true, mp: 3 },
    requirements: [],
    effects,
    effectOrigins: effects.map(() => ({
      family: 'skill',
      contentId: 'ordinary.skill',
      contentVersion: 1,
    })),
  }
}
function cast(state = resistingWorld(), command = action()) {
  return executeCombatAction(state, command, SELECT, CONTENT)
}
function resistanceEvents(events: readonly { event: string }[]) {
  return events.filter((event) => event.event === 'combat_status_resistance_resolved')
}

describe('pinned ordinary Skill Status Resistance', () => {
  it('forecasts eligible ordinals without RNG and cancels debuffs while retaining damage and costs', () => {
    const state = resistingWorld()
    const before = JSON.stringify(state)
    const preview = evaluateCombatAction(state, action(), SELECT, CONTENT)
    expect(preview.targetStatusResistances).toEqual([
      {
        targetCombatantId: 'target',
        resistanceChanceBasisPoints: 1500,
        eligibleEffectOrdinals: [1],
      },
    ])
    expect(JSON.stringify(state)).toBe(before)
    const result = cast(state)
    expect(result.state.tactical.battle.combatants.find((entry) => entry.id === 'target')?.hp).toBe(
      80,
    )
    expect(result.state.tactical.battle.combatants.find((entry) => entry.id === 'actor')?.mp).toBe(
      17,
    )
    expect(
      result.state.statusState.find((entry) => entry.combatantId === 'target')?.statuses,
    ).toEqual([])
    expect(resistanceEvents(result.events)).toMatchObject([{ resisted: true }])
    expect(result.state.tactical.battle.rng).toEqual(
      advanceBattleRng(state.tactical.battle.rng).state,
    )
  })
  it('shares one target roll across Root and all periodic harmful effects', () => {
    const state = resistingWorld()
    const result = cast(
      state,
      action([
        { type: 'apply-status', recipient: 'primary-unit', statusId: 'root', stacks: 1 },
        { type: 'poison', recipient: 'primary-unit' },
        { type: 'burn', recipient: 'primary-unit' },
        { type: 'bleed', recipient: 'primary-unit', damagePerTick: 3, ticks: 2 },
      ]),
    )
    expect(resistanceEvents(result.events)).toHaveLength(1)
    expect(normalizeCombatEffectState(result.state.effectState)).toMatchObject({
      poison: [],
      burn: [],
      bleed: [],
    })
    expect(
      result.state.statusState.find((entry) => entry.combatantId === 'target')?.statuses,
    ).toEqual([])
    expect(result.state.tactical.battle.rng).toEqual(
      advanceBattleRng(state.tactical.battle.rng).state,
    )
  })
  it.each(['essence', 'resonance', 'ascension', 'severance'] as const)(
    'preserves %s debuffs in mixed casts',
    (family) => {
      const command = action([
        { type: 'apply-status', recipient: 'primary-unit', statusId: 'root', stacks: 1 },
        { type: 'apply-status', recipient: 'primary-unit', statusId: 'test.debuff', stacks: 1 },
      ])
      command.effectOrigins = [
        { family: 'skill', contentId: command.id, contentVersion: 1 },
        { family, contentId: 'special', contentVersion: 1 },
      ]
      const result = cast(resistingWorld(), command)
      expect(
        result.state.statusState
          .find((entry) => entry.combatantId === 'target')
          ?.statuses.map((entry) => entry.statusId),
      ).toEqual(['test.debuff'])
    },
  )
  it.each(['zero', 'legacy', 'beneficial', 'special', 'basic', 'miss'] as const)(
    'draws no resistance RNG for %s',
    (mode) => {
      const state = mode === 'zero' ? world(0) : resistingWorld()
      let command = action()
      if (mode === 'legacy') delete state.statBalancePolicyVersion
      if (mode === 'beneficial')
        command = action([
          { type: 'apply-status', recipient: 'primary-unit', statusId: 'test.buff', stacks: 1 },
        ])
      if (mode === 'special')
        command.effectOrigins = command.effects.map(() => ({
          family: 'essence',
          contentId: 'special',
          contentVersion: 1,
        }))
      if (mode === 'basic') {
        command.sourceType = 'basic-attack'
        command.effectOrigins = undefined
      }
      if (mode === 'miss') {
        command = { ...command, accuracyMode: 'per-target' }
        state.statBridge = {
          ...state.statBridge!,
          combatants: state.statBridge!.combatants.map((entry) => ({ ...entry, accuracy: 0 })),
        }
      }
      const result = cast(state, command)
      expect(resistanceEvents(result.events)).toEqual([])
      const expected =
        mode === 'miss'
          ? advanceBattleRng(state.tactical.battle.rng).state
          : state.tactical.battle.rng
      expect(result.state.tactical.battle.rng).toEqual(expected)
    },
  )
  it('filters a resisted scheduled Root before scheduling and never rerolls accepted delayed effects', () => {
    const state = resistingWorld()
    state.effectTimingPolicy = { version: 1, modes: { root: 'next-round' } }
    const command = action([
      { type: 'apply-status', recipient: 'primary-unit', statusId: 'root', stacks: 1 },
    ])
    const resisted = cast(state, command)
    expect(resisted.state.pendingEffects ?? []).toEqual([])
    const acceptedState = resistingWorld()
    acceptedState.statBridge = {
      ...acceptedState.statBridge!,
      combatants: acceptedState.statBridge!.combatants.map((row) => ({
        ...row,
        statusResistance: 0,
      })),
    }
    acceptedState.effectTimingPolicy = state.effectTimingPolicy
    const accepted = cast(acceptedState, command)
    expect(accepted.state.pendingEffects).toHaveLength(1)
    let next: CombatEncounterState = {
      ...accepted.state,
      statBridge: {
        ...accepted.state.statBridge!,
        combatants: accepted.state.statBridge!.combatants.map((row) => ({
          ...row,
          statusResistance: 1500,
        })),
      },
    }
    for (let index = 0; index < 3; index++)
      next = endCombatTurn(
        { ...next, tactical: selectCurrentFinalFacing(next.tactical, 'east').state },
        CONTENT,
      ).state
    expect(
      next.statusState
        .find((entry) => entry.combatantId === 'target')
        ?.statuses.map((entry) => entry.statusId),
    ).toContain('root')
    expect(next.tactical.battle.rng).toEqual(accepted.state.tactical.battle.rng)
  })
  it('rejects malformed policies and incomplete/out-of-range resistance profiles', () => {
    const state = world()
    expect(
      validateCombatEncounterState({
        ...state,
        statBalancePolicyVersion: 2,
      } as unknown as CombatEncounterState).some(
        (issue) => issue.field === 'statBalancePolicyVersion',
      ),
    ).toBe(true)
    for (const resistance of [undefined, -1, 1501, NaN]) {
      const malformed = {
        ...state,
        statBridge: {
          ...state.statBridge!,
          combatants: state.statBridge!.combatants.map((entry) => ({
            ...entry,
            statusResistance: resistance,
          })),
        },
      }
      expect(
        validateCombatEncounterState(malformed).some((issue) =>
          issue.field.startsWith('statBridge'),
        ),
      ).toBe(true)
    }
  })
})

describe('resistance boundaries and expected utility', () => {
  it('resists hostile Curse transfer while keeping the donor state and damage outcome', () => {
    const state = resistingWorld()
    state.statusState = state.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'test.debuff',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'other',
              },
            ],
          }
        : row,
    )
    const command = action([
      { type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' },
      { type: 'damage', recipient: 'primary-unit', amount: 20 },
    ])
    const result = cast(state, command)
    expect(result.state.statusState.find((row) => row.combatantId === 'target')?.statuses).toEqual(
      [],
    )
    expect(result.state.statusState.find((row) => row.combatantId === 'actor')).toEqual(
      state.statusState.find((row) => row.combatantId === 'actor'),
    )
    expect(result.state.tactical.battle.combatants.find((row) => row.id === 'target')?.hp).toBe(80)
  })
  it('uses stable per-target area rolls and filters only the resisting recipient', () => {
    const state = resistingWorld()
    const command = action([
      { type: 'damage', recipient: 'affected-units', amount: 20 },
      { type: 'apply-status', recipient: 'affected-units', statusId: 'root', stacks: 1 },
    ])
    command.target = { ...command.target, shape: { kind: 'circle', radius: 1 } }
    const result = cast(state, command)
    const first = advanceBattleRng(state.tactical.battle.rng)
    const second = advanceBattleRng(first.state)
    const events = resistanceEvents(result.events)
    expect(events).toMatchObject([
      { targetCombatantId: 'other', rollBasisPoints: first.value % 10000 },
      { targetCombatantId: 'target', rollBasisPoints: second.value % 10000 },
    ])
    for (const [id, draw] of [
      ['other', first],
      ['target', second],
    ] as const) {
      expect(result.state.tactical.battle.combatants.find((row) => row.id === id)?.hp).toBe(80)
      expect(
        result.state.statusState
          .find((row) => row.combatantId === id)
          ?.statuses.some((entry) => entry.statusId === 'root'),
      ).toBe(draw.value % 10000 >= 1500)
    }
    expect(result.state.tactical.battle.rng).toEqual(second.state)
  })
  it('preserves Sensory purge when its ordinary Revealed application is resisted', () => {
    const state = resistingWorld()
    state.statusState = state.statusState.map((row) =>
      row.combatantId === 'target'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'covert',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'target',
              },
            ],
          }
        : row,
    )
    const content = {
      statuses: [
        ...CONTENT.statuses,
        createCovertStatusDefinition(2),
        createRevealedStatusDefinition(2),
      ],
    }
    const command = action([
      { type: 'sensory', recipient: 'primary-unit', revealedDurationOwnerTurnStarts: 2 },
    ])
    const preview = evaluateCombatAction(state, command, SELECT, content)
    expect(preview.targetStatusResistances).toMatchObject([{ eligibleEffectOrdinals: [1] }])
    const result = executeCombatAction(state, command, SELECT, content)
    expect(
      result.events.some(
        (event) => event.event === 'status_removed' && event.statusId === 'covert',
      ),
    ).toBe(true)
    expect(result.state.statusState.find((row) => row.combatantId === 'target')?.statuses).toEqual(
      [],
    )
  })
  it.each(['periodic', 'reactive'] as const)(
    'resists negative %s tags from ordinary Skills',
    (reactionClass) => {
      const content = {
        statuses: CONTENT.statuses.map((status) =>
          status.id === 'test.debuff' ? { ...status, reactionClass } : status,
        ),
      }
      const result = executeCombatAction(resistingWorld(), action(), SELECT, content)
      expect(
        result.state.statusState.find((row) => row.combatantId === 'target')?.statuses,
      ).toEqual([])
    },
  )
  it('retains MP drain and cleanses while exempting self-cost/system negative tags', () => {
    const state = resistingWorld()
    state.tactical = {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((unit) =>
          unit.id === 'target' ? { ...unit, mp: 10 } : unit,
        ),
      },
    }
    const content = {
      statuses: [
        ...CONTENT.statuses,
        {
          ...CONTENT.statuses.find((status) => status.id === 'test.debuff')!,
          id: 'test.system',
          reactionClass: 'system' as const,
        },
        {
          ...CONTENT.statuses.find((status) => status.id === 'test.debuff')!,
          id: 'test.cost',
          reactionClass: 'self-cost' as const,
        },
      ],
    }
    const command = action([
      { type: 'resource-change', recipient: 'primary-unit', resource: 'mp', delta: -5 },
      { type: 'apply-status', recipient: 'primary-unit', statusId: 'test.system', stacks: 1 },
      { type: 'apply-status', recipient: 'primary-unit', statusId: 'test.cost', stacks: 1 },
      { type: 'apply-status', recipient: 'actor', statusId: 'test.debuff', stacks: 1 },
    ])
    const result = executeCombatAction(state, command, SELECT, content)
    expect(resistanceEvents(result.events)).toEqual([])
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.mp).toBe(5)
    expect(
      result.state.statusState
        .find((row) => row.combatantId === 'target')
        ?.statuses.map((status) => status.statusId),
    ).toEqual(['test.cost', 'test.system'])
    expect(
      result.state.statusState
        .find((row) => row.combatantId === 'actor')
        ?.statuses.map((status) => status.statusId),
    ).toEqual(['test.debuff'])
    expect(result.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
  })
  it('does not reattribute an existing resisted status to a new cast', () => {
    const state = resistingWorld()
    const status = {
      statusId: 'test.debuff',
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'other',
    }
    state.statusState = state.statusState.map((row) =>
      row.combatantId === 'target' ? { ...row, statuses: [status] } : row,
    )
    const context = {
      provenance: createCombatActionProvenance({
        rulesetVersion: 4,
        sourceKind: 'discipline-skill',
        actionDefinitionId: 'ordinary.skill',
        actionVersion: 1,
        sourceCombatantId: 'actor',
        controllerCombatantId: 'actor',
        triggerChainId: 'chain:resist',
      }),
      triggerGuard: createCombatTriggerGuard({ triggerChainId: 'chain:resist' }),
    }
    const result = executeCombatAction(state, action(), SELECT, CONTENT, context)
    expect(result.state.statusState.find((row) => row.combatantId === 'target')?.statuses).toEqual([
      status,
    ])
  })
  it('discounts only eligible AI debuff ordinals and recognizes periodic harmful tags', () => {
    const state = resistingWorld() as StatDrivenCombatEncounterState
    const command = action([
      { type: 'apply-status', recipient: 'primary-unit', statusId: 'root', stacks: 1 },
      { type: 'poison', recipient: 'primary-unit' },
    ])
    command.effectOrigins = [
      { family: 'skill', contentId: command.id, contentVersion: 1 },
      { family: 'resonance', contentId: 'special', contentVersion: 1 },
    ]
    const preview = evaluateCombatAction(state, command, SELECT, CONTENT)
    expect(preview.projectedEffects.map((effect) => effect.effectOrdinal)).toEqual([0, 1])
    expect(projectedCombatEffectUtility(preview, state, command.effects)).toBeCloseTo(8 * 0.85 + 8)
  })
})

function raisedWorld(): CombatEncounterState {
  const state = world(0)
  return {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((unit) =>
          unit.id === 'other' ? { ...unit, hp: 0 } : unit,
        ),
      },
      tiles: state.tactical.tiles.map((tile) => ({ ...tile, elevation: tile.position.x })),
      movementProfiles: state.tactical.movementProfiles.map((profile) => ({
        ...profile,
        maxElevationStep: 1,
      })),
    },
  }
}
describe('forced movement shares pinned absolute elevation access', () => {
  it('rejects a push to absolute height two even from height one while legacy delta push remains', () => {
    const state = raisedWorld()
    const command = action([
      { type: 'displace', recipient: 'primary-unit', direction: 'push', distance: 1 },
    ])
    command.target = { ...command.target, maximumElevationDifference: null }
    const result = cast(state, command)
    expect(
      result.state.tactical.placements.find((unit) => unit.combatantId === 'target')?.position,
    ).toEqual({ x: 1, y: 0 })
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'displacement_failed', reason: 'elevation-step-too-high' }),
    )
    delete state.statBalancePolicyVersion
    expect(
      cast(state, command).state.tactical.placements.find((unit) => unit.combatantId === 'target')
        ?.position,
    ).toEqual({ x: 2, y: 0 })
  })
  it('allows displacement descent exceeding Jump without resistance', () => {
    const state = raisedWorld()
    state.tactical = {
      ...state.tactical,
      tiles: state.tactical.tiles.map((tile) => ({
        ...tile,
        elevation: tile.position.x === 1 ? 3 : 0,
      })),
    }
    const command = action([
      { type: 'displace', recipient: 'primary-unit', direction: 'push', distance: 1 },
    ])
    command.target = { ...command.target, maximumElevationDifference: null }
    const result = cast(state, command)
    expect(
      result.state.tactical.placements.find((unit) => unit.combatantId === 'target')?.position,
    ).toEqual({ x: 2, y: 0 })
    expect(resistanceEvents(result.events)).toEqual([])
  })
  it('checks absolute entry for rewind and permits descent', () => {
    const state = raisedWorld()
    state.turnOrigin = {
      combatantId: 'actor',
      turnNumber: state.tactical.battle.turnNumber,
      position: { x: 2, y: 0 },
    }
    const command = action([{ type: 'return-to-turn-start', recipient: 'actor' }])
    command.target = {
      ...command.target,
      kind: 'self',
      teamPolicy: 'self',
      minimumRange: 0,
      maximumRange: 0,
    }
    expect(evaluateCombatAction(state, command, { kind: 'self' }, CONTENT).legal).toBe(false)
    const lowered = {
      ...state,
      tactical: {
        ...state.tactical,
        tiles: state.tactical.tiles.map((tile) => ({
          ...tile,
          elevation: tile.position.x === 0 ? 3 : 0,
        })),
      },
    }
    expect(evaluateCombatAction(lowered, command, { kind: 'self' }, CONTENT).legal).toBe(true)
    expect(
      executeCombatAction(
        lowered,
        command,
        { kind: 'self' },
        CONTENT,
      ).state.tactical.placements.find((unit) => unit.combatantId === 'actor')?.position,
    ).toEqual({ x: 2, y: 0 })
  })
})

describe('delayed absolute entry and AI forecast boundaries', () => {
  it('rechecks delayed rewind entry when placement or destination elevation changes before activation', () => {
    const state = raisedWorld()
    state.tactical = {
      ...state.tactical,
      tiles: state.tactical.tiles.map((tile) => ({ ...tile, elevation: 0 })),
    }
    state.turnOrigin = {
      combatantId: 'actor',
      turnNumber: state.tactical.battle.turnNumber,
      position: { x: 2, y: 0 },
    }
    state.effectTimingPolicy = { version: 1, modes: { 'return-to-turn-start': 'next-round' } }
    const command = action([{ type: 'return-to-turn-start', recipient: 'actor' }])
    command.target = {
      ...command.target,
      kind: 'self',
      teamPolicy: 'self',
      minimumRange: 0,
      maximumRange: 0,
    }
    let next = executeCombatAction(state, command, { kind: 'self' }, CONTENT).state
    expect(next.pendingEffects).toHaveLength(1)
    next = {
      ...next,
      tactical: {
        ...next.tactical,
        tiles: next.tactical.tiles.map((tile) =>
          tile.position.x === 2 ? { ...tile, elevation: 2 } : tile,
        ),
      },
    }
    const events = []
    for (let index = 0; index < 2; index++) {
      const advanced = endCombatTurn(
        { ...next, tactical: selectCurrentFinalFacing(next.tactical, 'east').state },
        CONTENT,
      )
      next = advanced.state
      events.push(...advanced.events)
    }
    expect(next.tactical.placements.find((unit) => unit.combatantId === 'actor')?.position).toEqual(
      { x: 0, y: 0 },
    )
    expect(events.some((event) => event.event === 'combatant_rewound')).toBe(false)
  })
  it('rejects rewind destination blocked by the movement profile terrain override', () => {
    const state = raisedWorld()
    state.tactical = {
      ...state.tactical,
      terrains: [{ id: 'closed', traversalCost: 1 }, ...state.tactical.terrains],
      tiles: state.tactical.tiles.map((tile) => ({
        ...tile,
        elevation: 0,
        terrainId: tile.position.x === 2 ? 'closed' : 'open',
      })),
      movementProfiles: state.tactical.movementProfiles.map((profile) => ({
        ...profile,
        terrainCostOverrides: [{ terrainId: 'closed', traversalCost: null }],
      })),
      placements: state.tactical.placements.filter((row) => row.combatantId !== 'other'),
    }
    // Defeated units still require a valid placement, so put the inert body on ordinary ground.
    state.tactical = {
      ...state.tactical,
      placements: [
        ...state.tactical.placements,
        {
          combatantId: 'other',
          position: { x: 0, y: 0 },
          facing: 'east' as const,
          movementProfileId: 'ground',
        },
      ].sort((left, right) => left.combatantId.localeCompare(right.combatantId)),
    }
    state.turnOrigin = {
      combatantId: 'actor',
      turnNumber: state.tactical.battle.turnNumber,
      position: { x: 2, y: 0 },
    }
    const command = action([{ type: 'return-to-turn-start', recipient: 'actor' }])
    command.target = {
      ...command.target,
      kind: 'self',
      teamPolicy: 'self',
      minimumRange: 0,
      maximumRange: 0,
    }
    expect(evaluateCombatAction(state, command, { kind: 'self' }, CONTENT).legal).toBe(false)
  })
  it('resistance-discounts Curse AI utility without discounting its damage', () => {
    const state = resistingWorld() as StatDrivenCombatEncounterState
    state.statusState = state.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'test.debuff',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'other',
              },
            ],
          }
        : row,
    )
    const command = action([
      { type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' },
      { type: 'damage', recipient: 'primary-unit', amount: 20 },
    ])
    const preview = evaluateCombatAction(state, command, SELECT, CONTENT)
    expect(preview.projectedEffects.map((effect) => effect.effectOrdinal)).toEqual([0, 1])
    expect(projectedCombatEffectUtility(preview, state, command.effects)).toBeCloseTo(8 * 0.85 + 40)
  })
})

it('draws no resistance roll for an empty permitted Curse block', () => {
  const state = resistingWorld()
  const command = action([
    {
      type: 'copy-statuses',
      recipient: 'primary-unit',
      mode: 'curse',
      allowNoEligibleEffects: true,
    },
    { type: 'damage', recipient: 'primary-unit', amount: 20 },
  ])
  const result = cast(state, command)
  expect(resistanceEvents(result.events)).toEqual([])
  expect(result.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
  expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(80)
})

it('rolls resistance only for the successful hostile area recipient', () => {
  const state = resistingWorld()
  state.statBridge = {
    ...state.statBridge!,
    combatants: state.statBridge!.combatants.map((row) =>
      row.combatantId === 'other' ? { ...row, evasion: 10000 } : row,
    ),
  }
  const command = {
    ...action([
      { type: 'damage', recipient: 'affected-units', amount: 20 },
      { type: 'apply-status', recipient: 'affected-units', statusId: 'root', stacks: 1 },
    ]),
    accuracyMode: 'per-target' as const,
  }
  command.target = { ...command.target, shape: { kind: 'circle', radius: 1 } }
  const result = cast(state, command)
  expect(resistanceEvents(result.events)).toMatchObject([{ targetCombatantId: 'target' }])
  expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'other')?.hp).toBe(100)
  const hitOther = advanceBattleRng(state.tactical.battle.rng)
  const hitTarget = advanceBattleRng(hitOther.state)
  expect(result.state.tactical.battle.rng).toEqual(advanceBattleRng(hitTarget.state).state)
})

it('copies beneficial effects without a Status Resistance roll or donor mutation', () => {
  const state = resistingWorld()
  state.copyPolicyVersion = 1
  const donor = {
    statusId: 'test.buff',
    statusVersion: 1,
    stacks: 1,
    remainingOwnerTurnStarts: 2,
    sourceCombatantId: 'other',
  }
  state.statusState = state.statusState.map((row) =>
    row.combatantId === 'target' ? { ...row, statuses: [donor] } : row,
  )
  const result = cast(state, action([{ type: 'copy', recipient: 'primary-unit' }]))
  expect(resistanceEvents(result.events)).toEqual([])
  expect(result.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
  expect(result.state.statusState.find((row) => row.combatantId === 'target')?.statuses).toEqual([
    donor,
  ])
  expect(
    result.state.statusState
      .find((row) => row.combatantId === 'actor')
      ?.statuses.map((status) => status.statusId),
  ).toEqual(['test.buff'])
})

it('filters scheduled Poison at cast time and does not reroll when resistance rises before activation', () => {
  const state = resistingWorld()
  state.effectTimingPolicy = { version: 1, modes: { poison: 'next-round' } }
  const command = action([{ type: 'poison', recipient: 'primary-unit' }])
  expect(cast(state, command).state.pendingEffects ?? []).toEqual([])
  const acceptedState = {
    ...state,
    statBridge: {
      ...state.statBridge!,
      combatants: state.statBridge!.combatants.map((row) => ({ ...row, statusResistance: 0 })),
    },
  }
  const accepted = cast(acceptedState, command)
  expect(accepted.state.pendingEffects).toHaveLength(1)
  let next: CombatEncounterState = { ...accepted.state, statBridge: state.statBridge }
  for (let index = 0; index < 3; index++)
    next = endCombatTurn(
      { ...next, tactical: selectCurrentFinalFacing(next.tactical, 'east').state },
      CONTENT,
    ).state
  expect(
    normalizeCombatEffectState(next.effectState).poison.map(
      (instance) => instance.targetCombatantId,
    ),
  ).toEqual(['target'])
  expect(next.tactical.battle.rng).toEqual(accepted.state.tactical.battle.rng)
})

it('keeps current-policy Vengeance basis ordinals aligned after Sensory expansion', () => {
  const state = resistingWorld()
  state.statusState = state.statusState.map((row) =>
    row.combatantId === 'target'
      ? {
          ...row,
          statuses: [
            {
              statusId: 'covert',
              statusVersion: 1,
              stacks: 1,
              remainingOwnerTurnStarts: 2,
              sourceCombatantId: 'target',
            },
          ],
        }
      : row,
  )
  const content = {
    statuses: [
      ...CONTENT.statuses,
      createCovertStatusDefinition(2),
      createRevealedStatusDefinition(2),
    ],
  }
  const command = action([
    { type: 'sensory', recipient: 'primary-unit', revealedDurationOwnerTurnStarts: 2 },
    {
      type: 'damage',
      recipient: 'primary-unit',
      amount: 0,
      vengeance: { conversionBasisPoints: 10000, minimumDamage: 10, maximumDamage: 100 },
    },
  ])
  const preview = evaluateCombatAction(state, command, SELECT, content)
  expect(preview.vengeanceBasis?.map((basis) => basis.effectOrdinal)).toEqual([2])
  expect(
    preview.projectedEffects.find((effect) => effect.effectType === 'damage')?.effectOrdinal,
  ).toBe(2)
  expect(preview.targetStatusResistances?.[0]?.eligibleEffectOrdinals).toEqual([1])
  const result = executeCombatAction(state, command, SELECT, content)
  expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(90)
})
