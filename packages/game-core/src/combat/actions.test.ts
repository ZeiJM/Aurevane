import { describe, expect, it } from 'vitest'

import { createPendingBattle, startBattle, type CreatePendingBattleInput } from './battle-state'
import {
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  createTacticalBattleState,
  selectCurrentFinalFacing,
  type CombatPlacement,
  type CombatTile,
  type GridPosition,
} from './board'
import {
  P2_3_COMBAT_CONTENT,
  P2_3_GUARD_ACTION,
  P2_3_UNARMED_ATTACK_PROFILE,
  createBasicAttackDefinition,
  createCombatEncounterState,
  endCombatTurn,
  evaluateCombatAction,
  executeCombatAction,
  resolveTargetShapeTiles,
  validateCombatEncounterState,
  waitCurrentTurn,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatStatusInstance,
} from './actions'

function battleInput(options?: {
  wayfarerHp?: number
  wayfarerMp?: number
  recruitHp?: number
  extraCombatants?: CreatePendingBattleInput['combatants']
}): CreatePendingBattleInput {
  return {
    battleId: 'p2-3-action-test',
    rulesVersion: 1,
    contentVersion: 1,
    rngSeed: 0x55667788,
    combatants: [
      {
        id: 'wayfarer',
        teamId: 'players',
        initiative: 12,
        baseMovementBudget: 4,
        hp: options?.wayfarerHp ?? 164,
        maxHp: 164,
        mp: options?.wayfarerMp ?? 90,
        maxMp: 90,
      },
      {
        id: 'recruit',
        teamId: 'opponents',
        initiative: 8,
        baseMovementBudget: 3,
        hp: options?.recruitHp ?? 120,
        maxHp: 120,
        mp: 30,
        maxMp: 30,
      },
      ...(options?.extraCombatants ?? []),
    ],
  }
}

function tile(x: number, y: number, terrainId = 'open-ground', elevation = 0): CombatTile {
  return { position: { x, y }, elevation, terrainId }
}

function rectangularTiles(width = 5, height = 3): CombatTile[] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => tile(x, y)),
  ).flat()
}

function activeEncounter(options?: {
  wayfarerHp?: number
  wayfarerMp?: number
  recruitHp?: number
  wayfarerPosition?: GridPosition
  recruitPosition?: GridPosition
  wayfarerFacing?: CombatPlacement['facing']
  recruitFacing?: CombatPlacement['facing']
  tiles?: readonly CombatTile[]
  extraCombatants?: CreatePendingBattleInput['combatants']
  extraPlacements?: readonly CombatPlacement[]
  statusState?: readonly {
    combatantId: string
    statuses: readonly CombatStatusInstance[]
  }[]
}): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle(
      battleInput({
        wayfarerHp: options?.wayfarerHp,
        wayfarerMp: options?.wayfarerMp,
        recruitHp: options?.recruitHp,
        extraCombatants: options?.extraCombatants,
      }),
    ),
  ).state

  const tactical = createTacticalBattleState({
    battle,
    width: 5,
    height: 3,
    terrains: P2_2_VERTICAL_SLICE_TERRAINS,
    tiles: options?.tiles ?? rectangularTiles(),
    movementProfiles: [P2_2_ORDINARY_GROUND_PROFILE],
    placements: [
      {
        combatantId: 'wayfarer',
        position: options?.wayfarerPosition ?? { x: 1, y: 1 },
        facing: options?.wayfarerFacing ?? 'east',
        movementProfileId: 'ordinary-ground',
      },
      {
        combatantId: 'recruit',
        position: options?.recruitPosition ?? { x: 2, y: 1 },
        facing: options?.recruitFacing ?? 'west',
        movementProfileId: 'ordinary-ground',
      },
      ...(options?.extraPlacements ?? []),
    ],
  })

  return createCombatEncounterState(tactical, options?.statusState)
}

function withFinalFacing(
  state: CombatEncounterState,
  facing: CombatPlacement['facing'],
): CombatEncounterState {
  const transition = selectCurrentFinalFacing(state.tactical, facing)
  return createCombatEncounterState(transition.state, state.statusState)
}

function currentCombatant(state: CombatEncounterState, combatantId: string) {
  const combatant = state.tactical.battle.combatants.find(
    (candidate) => candidate.id === combatantId,
  )
  if (!combatant) throw new Error(`Missing test combatant ${combatantId}.`)
  return combatant
}

const basicAttack = createBasicAttackDefinition(P2_3_UNARMED_ATTACK_PROFILE)

describe('P2.3 targeting, actions and effects', () => {
  it('evaluates and executes Basic Attack through shared targeting/effect grammar', () => {
    const state = activeEncounter()
    const evaluation = evaluateCombatAction(
      state,
      basicAttack,
      { kind: 'unit', combatantId: 'recruit' },
      P2_3_COMBAT_CONTENT,
    )

    expect(evaluation).toMatchObject({
      legal: true,
      actionId: 'basic.attack.unarmed.basic',
      actorId: 'wayfarer',
      primaryCombatantId: 'recruit',
      affectedCombatantIds: ['recruit'],
      mpCost: 0,
      spendsAction: true,
      issues: [],
    })
    expect(evaluation.projectedEffects).toEqual([
      {
        effectType: 'damage',
        combatantId: 'recruit',
        before: 120,
        after: 104,
      },
    ])

    const resolved = executeCombatAction(
      state,
      basicAttack,
      { kind: 'unit', combatantId: 'recruit' },
      P2_3_COMBAT_CONTENT,
    )

    expect(currentCombatant(resolved.state, 'recruit').hp).toBe(104)
    expect(resolved.state.tactical.battle.currentTurn?.actionState).toBe('spent')
    expect(resolved.events).toEqual([
      { event: 'action_spent', combatantId: 'wayfarer' },
      {
        event: 'combat_action_used',
        actionId: 'basic.attack.unarmed.basic',
        actorId: 'wayfarer',
      },
      {
        event: 'damage_applied',
        actionId: 'basic.attack.unarmed.basic',
        sourceCombatantId: 'wayfarer',
        targetCombatantId: 'recruit',
        amount: 16,
        hpBefore: 120,
        hpAfter: 104,
      },
    ])
  })

  it('applies deterministic front/side/rear attack profile modifiers', () => {
    const front = activeEncounter({ recruitFacing: 'west' })
    const rear = activeEncounter({ recruitFacing: 'east' })
    const side = activeEncounter({ recruitFacing: 'north' })

    const projected = (state: CombatEncounterState) =>
      evaluateCombatAction(
        state,
        basicAttack,
        { kind: 'unit', combatantId: 'recruit' },
        P2_3_COMBAT_CONTENT,
      ).projectedEffects[0]

    expect(projected(front)).toMatchObject({ before: 120, after: 104 })
    expect(projected(side)).toMatchObject({ before: 120, after: 103 })
    expect(projected(rear)).toMatchObject({ before: 120, after: 100 })
  })

  it('Guard consumes the Action, reduces incoming damage, then expires at the next owner turn start', () => {
    let state = activeEncounter()

    const guarded = executeCombatAction(
      state,
      P2_3_GUARD_ACTION,
      { kind: 'self' },
      P2_3_COMBAT_CONTENT,
    )
    state = guarded.state

    expect(state.statusState.find((row) => row.combatantId === 'wayfarer')?.statuses).toEqual([
      {
        statusId: 'guarded',
        statusVersion: 1,
        stacks: 1,
        remainingOwnerTurnStarts: 1,
        sourceCombatantId: 'wayfarer',
      },
    ])
    expect(state.tactical.battle.currentTurn?.actionState).toBe('spent')

    state = withFinalFacing(state, 'east')
    state = endCombatTurn(state, P2_3_COMBAT_CONTENT).state
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('recruit')

    const enemyAttack = executeCombatAction(
      state,
      basicAttack,
      { kind: 'unit', combatantId: 'wayfarer' },
      P2_3_COMBAT_CONTENT,
    )
    state = enemyAttack.state

    expect(currentCombatant(state, 'wayfarer').hp).toBe(152)
    expect(enemyAttack.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'damage_applied',
          targetCombatantId: 'wayfarer',
          amount: 12,
        }),
      ]),
    )

    state = withFinalFacing(state, 'west')
    const nextTurn = endCombatTurn(state, P2_3_COMBAT_CONTENT)
    state = nextTurn.state
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('wayfarer')
    expect(state.statusState.find((row) => row.combatantId === 'wayfarer')?.statuses).toEqual([])
    expect(nextTurn.events).toEqual(
      expect.arrayContaining([
        { event: 'status_expired', combatantId: 'wayfarer', statusId: 'guarded' },
      ]),
    )
  })

  it('rejects Guard while the actor already has Guarded', () => {
    const state = activeEncounter({
      statusState: [
        {
          combatantId: 'wayfarer',
          statuses: [
            {
              statusId: 'guarded',
              statusVersion: 1,
              stacks: 1,
              remainingOwnerTurnStarts: 1,
              sourceCombatantId: 'wayfarer',
            },
          ],
        },
      ],
    })

    expect(
      evaluateCombatAction(state, P2_3_GUARD_ACTION, { kind: 'self' }, P2_3_COMBAT_CONTENT),
    ).toMatchObject({
      legal: false,
      issues: [expect.objectContaining({ code: 'requirement-not-met' })],
    })
  })

  it('requires final facing before Wait can end the turn', () => {
    expect(() => waitCurrentTurn(activeEncounter(), P2_3_COMBAT_CONTENT)).toThrow(
      'Final facing must be selected',
    )
  })

  it('Wait ends the turn without spending the Action after final facing is selected', () => {
    const state = withFinalFacing(activeEncounter(), 'east')
    const waited = waitCurrentTurn(state, P2_3_COMBAT_CONTENT)

    expect(waited.state.tactical.battle.currentTurn).toMatchObject({
      combatantId: 'recruit',
      actionState: 'ready',
    })
    expect(waited.events).toEqual([
      { event: 'combatant_waited', combatantId: 'wayfarer' },
      { event: 'turn_ended', round: 1, turnNumber: 1, combatantId: 'wayfarer' },
      { event: 'turn_started', round: 1, turnNumber: 2, combatantId: 'recruit' },
    ])
  })

  it('rejects a second Action in the same turn', () => {
    const afterAttack = executeCombatAction(
      activeEncounter(),
      basicAttack,
      { kind: 'unit', combatantId: 'recruit' },
      P2_3_COMBAT_CONTENT,
    ).state

    expect(
      evaluateCombatAction(
        afterAttack,
        basicAttack,
        { kind: 'unit', combatantId: 'recruit' },
        P2_3_COMBAT_CONTENT,
      ),
    ).toMatchObject({
      legal: false,
      issues: [expect.objectContaining({ code: 'action-already-spent' })],
    })
  })

  it('applies MP cost before projecting and resolving ordered resource effects', () => {
    const action: CombatActionDefinition = {
      id: 'test.channel-focus',
      version: 1,
      sourceType: 'test',
      tags: ['test', 'utility'],
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
      cost: { spendsAction: true, mp: 10 },
      requirements: [],
      effects: [{ type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 5 }],
    }
    const state = activeEncounter({ wayfarerMp: 50 })

    expect(
      evaluateCombatAction(state, action, { kind: 'self' }, P2_3_COMBAT_CONTENT),
    ).toMatchObject({
      legal: true,
      projectedEffects: [
        {
          effectType: 'resource-change',
          combatantId: 'wayfarer',
          before: 40,
          after: 45,
        },
      ],
    })

    const resolved = executeCombatAction(state, action, { kind: 'self' }, P2_3_COMBAT_CONTENT)
    expect(currentCombatant(resolved.state, 'wayfarer').mp).toBe(45)
    expect(resolved.events).toEqual(
      expect.arrayContaining([
        { event: 'mp_spent', combatantId: 'wayfarer', amount: 10, remaining: 40 },
        expect.objectContaining({
          event: 'resource_changed',
          targetCombatantId: 'wayfarer',
          before: 40,
          after: 45,
        }),
      ]),
    )
  })

  it('fails closed when MP is insufficient', () => {
    const action: CombatActionDefinition = {
      ...P2_3_GUARD_ACTION,
      id: 'test.expensive-guard',
      cost: { spendsAction: true, mp: 20 },
    }
    const state = activeEncounter({ wayfarerMp: 10 })

    expect(
      evaluateCombatAction(state, action, { kind: 'self' }, P2_3_COMBAT_CONTENT),
    ).toMatchObject({
      legal: false,
      issues: [expect.objectContaining({ code: 'insufficient-mp' })],
    })
  })

  it.each([
    {
      name: 'ally target for an enemy-only Basic Attack',
      build: () =>
        activeEncounter({
          extraCombatants: [
            {
              id: 'ally',
              teamId: 'players',
              initiative: 4,
              baseMovementBudget: 4,
              hp: 100,
              maxHp: 100,
              mp: 20,
              maxMp: 20,
            },
          ],
          extraPlacements: [
            {
              combatantId: 'ally',
              position: { x: 1, y: 2 },
              facing: 'north',
              movementProfileId: 'ordinary-ground',
            },
          ],
        }),
      selection: { kind: 'unit', combatantId: 'ally' } as const,
      issue: 'target-team-not-allowed',
    },
    {
      name: 'defeated target',
      build: () =>
        activeEncounter({
          recruitHp: 0,
          extraCombatants: [
            {
              id: 'recruit-two',
              teamId: 'opponents',
              initiative: 6,
              baseMovementBudget: 3,
              hp: 80,
              maxHp: 80,
              mp: 20,
              maxMp: 20,
            },
          ],
          extraPlacements: [
            {
              combatantId: 'recruit-two',
              position: { x: 4, y: 2 },
              facing: 'west',
              movementProfileId: 'ordinary-ground',
            },
          ],
        }),
      selection: { kind: 'unit', combatantId: 'recruit' } as const,
      issue: 'target-defeated',
    },
    {
      name: 'out-of-range target',
      build: () => activeEncounter({ recruitPosition: { x: 4, y: 1 } }),
      selection: { kind: 'unit', combatantId: 'recruit' } as const,
      issue: 'target-out-of-range',
    },
    {
      name: 'target beyond allowed elevation difference',
      build: () =>
        activeEncounter({
          tiles: rectangularTiles().map((entry) =>
            entry.position.x === 2 && entry.position.y === 1 ? { ...entry, elevation: 2 } : entry,
          ),
        }),
      selection: { kind: 'unit', combatantId: 'recruit' } as const,
      issue: 'target-elevation-invalid',
    },
  ])('reports stable legality for $name', ({ build, selection, issue }) => {
    expect(
      evaluateCombatAction(build(), basicAttack, selection, P2_3_COMBAT_CONTENT),
    ).toMatchObject({
      legal: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: issue })]),
    })
  })

  it('enforces baseline line of sight through blocking terrain', () => {
    const ranged = createBasicAttackDefinition({
      ...P2_3_UNARMED_ATTACK_PROFILE,
      id: 'test.ranged',
      maximumRange: 4,
      requiresLineOfSight: true,
    })
    const state = activeEncounter({
      wayfarerPosition: { x: 0, y: 1 },
      recruitPosition: { x: 4, y: 1 },
      tiles: rectangularTiles().map((entry) =>
        entry.position.x === 2 && entry.position.y === 1
          ? { ...entry, terrainId: 'blocked' }
          : entry,
      ),
    })

    expect(
      evaluateCombatAction(
        state,
        ranged,
        { kind: 'unit', combatantId: 'recruit' },
        P2_3_COMBAT_CONTENT,
      ),
    ).toMatchObject({
      legal: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'line-of-sight-blocked' })]),
    })
  })

  it('requires an empty tile when the target spec says empty-tile', () => {
    const action: CombatActionDefinition = {
      id: 'test.empty-marker',
      version: 1,
      sourceType: 'test',
      tags: ['test', 'utility'],
      target: {
        kind: 'empty-tile',
        teamPolicy: 'any',
        shape: { kind: 'single' },
        minimumRange: 1,
        maximumRange: 3,
        requiresLineOfSight: false,
        maximumElevationDifference: 1,
        friendlyFire: 'all-units',
      },
      cost: { spendsAction: true, mp: 0 },
      requirements: [],
      effects: [],
    }

    expect(
      evaluateCombatAction(
        activeEncounter(),
        action,
        { kind: 'tile', position: { x: 2, y: 1 } },
        P2_3_COMBAT_CONTENT,
      ),
    ).toMatchObject({
      legal: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'target-tile-occupied' })]),
    })
  })

  it('resolves circle area effects with explicit enemies-only friendly fire', () => {
    const extraCombatants: CreatePendingBattleInput['combatants'] = [
      {
        id: 'recruit-two',
        teamId: 'opponents',
        initiative: 6,
        baseMovementBudget: 3,
        hp: 80,
        maxHp: 80,
        mp: 20,
        maxMp: 20,
      },
      {
        id: 'ally',
        teamId: 'players',
        initiative: 4,
        baseMovementBudget: 4,
        hp: 100,
        maxHp: 100,
        mp: 20,
        maxMp: 20,
      },
    ]
    const state = activeEncounter({
      wayfarerPosition: { x: 0, y: 1 },
      recruitPosition: { x: 2, y: 1 },
      extraCombatants,
      extraPlacements: [
        {
          combatantId: 'recruit-two',
          position: { x: 2, y: 2 },
          facing: 'west',
          movementProfileId: 'ordinary-ground',
        },
        {
          combatantId: 'ally',
          position: { x: 2, y: 0 },
          facing: 'south',
          movementProfileId: 'ordinary-ground',
        },
      ],
    })
    const action: CombatActionDefinition = {
      id: 'test.shock-circle',
      version: 1,
      sourceType: 'test',
      tags: ['test', 'area'],
      target: {
        kind: 'ground-tile',
        teamPolicy: 'any',
        shape: { kind: 'circle', radius: 1 },
        minimumRange: 1,
        maximumRange: 4,
        requiresLineOfSight: false,
        maximumElevationDifference: 1,
        friendlyFire: 'enemies-only',
      },
      cost: { spendsAction: true, mp: 0 },
      requirements: [],
      effects: [{ type: 'damage', recipient: 'affected-units', amount: 10 }],
    }

    const evaluation = evaluateCombatAction(
      state,
      action,
      { kind: 'tile', position: { x: 2, y: 1 } },
      P2_3_COMBAT_CONTENT,
    )
    expect(evaluation.legal).toBe(true)
    expect(evaluation.affectedCombatantIds).toEqual(['recruit', 'recruit-two'])

    const resolved = executeCombatAction(
      state,
      action,
      { kind: 'tile', position: { x: 2, y: 1 } },
      P2_3_COMBAT_CONTENT,
    )
    expect(currentCombatant(resolved.state, 'recruit').hp).toBe(110)
    expect(currentCombatant(resolved.state, 'recruit-two').hp).toBe(70)
    expect(currentCombatant(resolved.state, 'ally').hp).toBe(100)
  })

  it('clamps authored healing and MP resource changes to authoritative maxima/minima', () => {
    const healing: CombatActionDefinition = {
      id: 'test.healing-effect',
      version: 1,
      sourceType: 'test',
      tags: ['test', 'healing'],
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
      cost: { spendsAction: true, mp: 0 },
      requirements: [],
      effects: [
        { type: 'healing', recipient: 'actor', amount: 1000 },
        { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: -1000 },
      ],
    }
    const state = activeEncounter({ wayfarerHp: 100, wayfarerMp: 20 })
    const resolved = executeCombatAction(state, healing, { kind: 'self' }, P2_3_COMBAT_CONTENT)

    expect(currentCombatant(resolved.state, 'wayfarer')).toMatchObject({ hp: 164, mp: 0 })
  })

  it('supports actor HP and target-status use requirements without embedding one-off action logic', () => {
    const hpRequirement: CombatActionDefinition = {
      ...P2_3_GUARD_ACTION,
      id: 'test.low-hp-guard',
      requirements: [{ kind: 'actor-hp-at-most', basisPoints: 5_000 }],
    }
    expect(
      evaluateCombatAction(
        activeEncounter({ wayfarerHp: 164 }),
        hpRequirement,
        { kind: 'self' },
        P2_3_COMBAT_CONTENT,
      ),
    ).toMatchObject({
      legal: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'requirement-not-met' })]),
    })

    const targetRequirement: CombatActionDefinition = {
      ...basicAttack,
      id: 'test.break-guard',
      requirements: [{ kind: 'target-status-present', statusId: 'guarded' }],
    }
    expect(
      evaluateCombatAction(
        activeEncounter(),
        targetRequirement,
        { kind: 'unit', combatantId: 'recruit' },
        P2_3_COMBAT_CONTENT,
      ),
    ).toMatchObject({
      legal: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'requirement-not-met' })]),
    })
  })

  it('resolves Single, Circle and cardinal Line shapes deterministically', () => {
    const state = activeEncounter().tactical

    expect(
      resolveTargetShapeTiles(state, { x: 0, y: 1 }, { x: 2, y: 1 }, { kind: 'single' }),
    ).toEqual([{ x: 2, y: 1 }])
    expect(
      resolveTargetShapeTiles(state, { x: 0, y: 1 }, { x: 2, y: 1 }, { kind: 'circle', radius: 1 }),
    ).toEqual([
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 2, y: 2 },
    ])
    expect(
      resolveTargetShapeTiles(state, { x: 0, y: 1 }, { x: 3, y: 1 }, { kind: 'line', length: 4 }),
    ).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    expect(
      resolveTargetShapeTiles(state, { x: 0, y: 1 }, { x: 2, y: 2 }, { kind: 'line', length: 4 }),
    ).toEqual([])
  })

  it('completes the battle when an action defeats the last opposing team member', () => {
    const state = activeEncounter({ recruitHp: 10 })
    const resolved = executeCombatAction(
      state,
      basicAttack,
      { kind: 'unit', combatantId: 'recruit' },
      P2_3_COMBAT_CONTENT,
    )

    expect(currentCombatant(resolved.state, 'recruit').hp).toBe(0)
    expect(resolved.state.tactical.battle).toMatchObject({
      lifecycle: 'completed',
      currentTurn: null,
    })
    expect(resolved.events.at(-1)).toEqual({
      event: 'battle_completed',
      winningTeamId: 'players',
    })
  })

  it('normalizes sparse status input but rejects duplicate or unknown status rows', () => {
    const state = activeEncounter({
      statusState: [
        {
          combatantId: 'wayfarer',
          statuses: [
            {
              statusId: 'zeta-test',
              statusVersion: 1,
              stacks: 1,
              remainingOwnerTurnStarts: 2,
              sourceCombatantId: 'wayfarer',
            },
            {
              statusId: 'alpha-test',
              statusVersion: 1,
              stacks: 1,
              remainingOwnerTurnStarts: 1,
              sourceCombatantId: 'recruit',
            },
          ],
        },
      ],
    })

    expect(state.statusState.map((row) => row.combatantId)).toEqual(['recruit', 'wayfarer'])
    expect(
      state.statusState
        .find((row) => row.combatantId === 'wayfarer')
        ?.statuses.map((status) => status.statusId),
    ).toEqual(['alpha-test', 'zeta-test'])
    expect(validateCombatEncounterState(state)).toEqual([])

    const tactical = activeEncounter().tactical
    expect(() =>
      createCombatEncounterState(tactical, [
        { combatantId: 'wayfarer', statuses: [] },
        { combatantId: 'wayfarer', statuses: [] },
      ]),
    ).toThrow('Duplicate status-state row')
    expect(() =>
      createCombatEncounterState(tactical, [{ combatantId: 'outsider', statuses: [] }]),
    ).toThrow('Unknown status-state combatant')
  })
})
