import { afterEach, describe, expect, it, vi } from 'vitest'
import * as nativeEconomy from './pv1f-action-economy'

import {
  createCombatEncounterState,
  executeCombatAction,
  evaluateCombatAction,
  type CombatActionDefinition,
} from './actions'
import { createPendingBattle, endTurn, selectFinalFacing, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import type { CombatSummonInstance } from './combat-effect-state'
import { spawnCombatSummon, removeCombatSummon } from './combat-summons'
import {
  executePv1fAction,
  evaluatePv1fAction,
  PV1F_BASIC_ATTACK_ID,
  executePv1fMovement,
  evaluatePv1fMovement,
  PV1F_COMBAT_CONTENT,
  executePv1fSummonAbility,
  evaluatePv1fSummonAbility,
  finishPv1fTurn,
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
  spendPv1fActionEconomy,
} from './pv1f-action-economy'
import { evaluatePreparedCombatWalking } from './combat-walking'
import { chooseSummonAiDecision, type SummonAiDecision } from './summon-ai'
import {
  createCurrentStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfileV4,
  validateStatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { SUMMON_PROFILE_SCHEMA_VERSION, type SummonProfileDefinition } from './summon-content'

function combatProfile(
  combatantId: string,
  team: 'players' | 'opponents',
): StatDrivenCombatProfileV4 {
  return {
    combatantId,
    provenance: {
      kind: team === 'players' ? 'character-derived' : 'scenario',
      sourceId: team === 'players' ? 'character:test-player' : 'scenario:test-opponent',
      sourceRulesVersion: 4,
    },
    accuracy: 8000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
    physicalPower: 30,
    mysticPower: 30,
    level: 1,
    criticalChance: 0,
  }
}

function summonProfile(overrides: Partial<SummonProfileDefinition> = {}): SummonProfileDefinition {
  return {
    schemaVersion: SUMMON_PROFILE_SCHEMA_VERSION,
    id: 'summon.wildwarden.verdant-stalker',
    name: 'Verdant Stalker',
    description: 'A temporary woodland hunter that fights beside the summoner.',
    flavorLine: 'Roots twist into a watchful hunter at your side.',
    portraitKey: 'summon.wildwarden.verdant-stalker.portrait',
    tags: ['summon', 'beast', 'verdant'],
    maxHp: 36,
    maxMp: 12,
    initiative: 28,
    movementBudget: 5,
    stats: {
      accuracy: 8000,
      evasion: 1200,
      armor: 8,
      ward: 6,
      jump: 1,
      physicalPower: 24,
      mysticPower: 18,
    },
    aiProfile: 'standard',
    aiPurposeTags: ['damage', 'support'],
    lifetimeTurns: 5,
    abilities: [
      {
        id: 'wildwarden.verdant-stalker.thorn-rake',
        name: 'Thorn Rake',
        description: 'Strike a nearby enemy with thorned claws.',
        apCost: 45,
        mpCost: 0,
        tags: ['attack', 'melee'],
        target: {
          kind: 'unit',
          teamPolicy: 'enemy',
          shape: { kind: 'single' },
          minimumRange: 1,
          maximumRange: 2,
          requiresLineOfSight: true,
          maximumElevationDifference: 0,
          friendlyFire: 'enemies-only',
        },
        requirements: [],
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 8, durationTurns: 0 }],
        ai: { baseUtility: 70, purposeTags: ['damage', 'pressure'] },
        media: {
          iconKey: 'summon-ability.wildwarden.verdant-stalker.thorn-rake.icon',
          audioCueKey: null,
          vfxKey: null,
        },
      },
      {
        id: 'wildwarden.verdant-stalker.verdant-mend',
        name: 'Verdant Mend',
        description: 'Restore an injured ally.',
        apCost: 45,
        mpCost: 0,
        tags: ['heal', 'support'],
        target: {
          kind: 'unit',
          teamPolicy: 'ally',
          shape: { kind: 'single' },
          minimumRange: 1,
          maximumRange: 2,
          requiresLineOfSight: true,
          maximumElevationDifference: 0,
          friendlyFire: 'allies-only',
        },
        requirements: [],
        effects: [{ type: 'healing', recipient: 'primary-unit', amount: 12, durationTurns: 0 }],
        ai: { baseUtility: 70, purposeTags: ['heal', 'support'] },
        media: {
          iconKey: 'summon-ability.wildwarden.verdant-stalker.verdant-mend.icon',
          audioCueKey: null,
          vfxKey: null,
        },
      },
    ],
    ...overrides,
  }
}

function encounter(playerHp: number): StatDrivenCombatEncounterState {
  const pending = createPendingBattle({
    battleId: 'battle:summon-ai',
    rulesVersion: 1,
    contentVersion: 1,
    rngSeed: 991,
    combatants: [
      {
        id: 'player',
        teamId: 'players',
        initiative: 20,
        baseMovementBudget: 4,
        hp: playerHp,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
      },
      {
        id: 'enemy',
        teamId: 'opponents',
        initiative: 10,
        baseMovementBudget: 4,
        hp: 50,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
      },
    ],
  })
  const battle = startBattle(pending).state
  const tactical = createTacticalBattleState({
    battle,
    width: 4,
    height: 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 2, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 3, y: 0 }, elevation: 0, terrainId: 'open-ground' },
    ],
    movementProfiles: [
      { id: 'player-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      { id: 'enemy-ground', maxElevationStep: 1, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId: 'player',
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'player-ground',
      },
      {
        combatantId: 'enemy',
        position: { x: 3, y: 0 },
        facing: 'west',
        movementProfileId: 'enemy-ground',
      },
    ],
  })
  return createCurrentStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    combatProfile('player', 'players'),
    combatProfile('enemy', 'opponents'),
  ])
}

function summonTurn(
  playerHp = 20,
  profile = summonProfile(),
): {
  state: StatDrivenCombatEncounterState
  summon: CombatSummonInstance
} {
  const spawned = spawnCombatSummon(encounter(playerHp), {
    ownerCombatantId: 'player',
    sourceSkillId: 'wildwarden.renewing-herbs',
    sourceSkillVersion: 5,
    profile,
    position: { x: 1, y: 0 },
    facing: 'east',
  })
  const summon = spawned.state.effectState?.summons?.[0]
  if (!summon) throw new Error('Expected summoned ally.')

  let battle = selectFinalFacing(spawned.state.tactical.battle, 'east').state
  battle = endTurn(battle).state
  battle = selectFinalFacing(battle, 'west').state
  battle = endTurn(battle).state

  return {
    state: preparePv1fTurnEconomy({
      ...spawned.state,
      tactical: { ...spawned.state.tactical, battle },
    }),
    summon,
  }
}

function chosenAbility(decision: SummonAiDecision): string | null {
  return decision.intent.kind === 'action' ? decision.intent.actionId : null
}

describe('Combat v5.1 summon AI', () => {
  afterEach(() => vi.restoreAllMocks())

  it('passes at 10 AP without forecasting unaffordable authored abilities', () => {
    const active = summonTurn(20)
    const state = spendPv1fActionEconomy(active.state, 90)
    const before = JSON.stringify(state)
    const forecast = vi.spyOn(nativeEconomy, 'evaluatePv1fSummonAbility')
    const walking = vi.spyOn(nativeEconomy, 'executePv1fMovement')
    const decision = chooseSummonAiDecision({ ...active, state, tieBreakSeed: 45 })
    expect(decision.intent.kind).toBe('face')
    expect(JSON.stringify(state)).toBe(before)
    expect(forecast).not.toHaveBeenCalled()
    expect(walking).not.toHaveBeenCalled()
  })

  it('does not forecast after the one authored ability has already been used this turn', () => {
    const active = summonTurn(50)
    const state = executePv1fSummonAbility(
      active.state,
      active.summon,
      active.summon.profile.abilities[0]!.id,
      { kind: 'unit', combatantId: 'enemy' },
    ).state
    const before = JSON.stringify(state)
    const forecast = vi.spyOn(nativeEconomy, 'evaluatePv1fSummonAbility')
    const walking = vi.spyOn(nativeEconomy, 'executePv1fMovement')
    expect(chooseSummonAiDecision({ ...active, state, tieBreakSeed: 45 }).intent.kind).not.toBe(
      'action',
    )
    expect(JSON.stringify(state)).toBe(before)
    expect(forecast).not.toHaveBeenCalled()
    expect(walking).not.toHaveBeenCalled()
  })

  it('skips walks that cannot leave enough AP for even the cheapest ability', () => {
    const active = summonTurn(20)
    const state = spendPv1fActionEconomy(active.state, 55)
    const walking = vi.spyOn(nativeEconomy, 'executePv1fMovement')
    expect(chosenAbility(chooseSummonAiDecision({ ...active, state, tieBreakSeed: 45 }))).toBe(
      'wildwarden.verdant-stalker.verdant-mend',
    )
    expect(walking.mock.calls.length).toBe(0)
  })

  it('does not forecast or extend a real walk that leaves too little AP for an ability', () => {
    const active = summonTurn(20)
    const state = spendPv1fActionEconomy(active.state, 45)
    const before = JSON.stringify(state)
    const forecast = vi.spyOn(nativeEconomy, 'evaluatePv1fSummonAbility')
    const walking = vi.spyOn(nativeEconomy, 'executePv1fMovement')
    expect(chosenAbility(chooseSummonAiDecision({ ...active, state, tieBreakSeed: 45 }))).toBe(
      'wildwarden.verdant-stalker.verdant-mend',
    )
    expect(JSON.stringify(state)).toBe(before)
    expect(forecast.mock.calls.length).toBe(6)
    expect(
      forecast.mock.calls.every(([shadow]) => readPv1fActionEconomy(shadow)!.current === 55),
    ).toBe(true)
    expect(walking.mock.calls.map(([, path]) => path)).toEqual([
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      [
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ],
    ])
  })

  it('retains a 10 AP Haste walk followed by an exactly affordable authored ability', () => {
    const attack = summonProfile().abilities[0]!
    const active = summonTurn(
      50,
      summonProfile({
        abilities: [{ ...attack, target: { ...attack.target, maximumRange: 1 } }],
      }),
    )
    const economy = spendPv1fActionEconomy(active.state, 45)
    const state = {
      ...economy,
      statusState: economy.statusState.map((row) =>
        row.combatantId === active.summon.combatantId
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'haste',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  movementApAdjustment: 15,
                  sourceCombatantId: 'player',
                },
              ],
            }
          : row,
      ),
    }
    expect(validateStatDrivenCombatEncounterState(state)).toEqual([])
    const decision = chooseSummonAiDecision({ ...active, state, tieBreakSeed: 45 })
    expect(decision.intent).toEqual({
      kind: 'move',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    })
    if (decision.intent.kind !== 'move') throw new Error('Expected affordable Haste positioning.')
    const moved = executePv1fMovement(state, decision.intent.path).state
    expect(readPv1fActionEconomy(moved)!.current).toBe(45)
    const followup = chooseSummonAiDecision({ ...active, state: moved, tieBreakSeed: 46 })
    expect(followup.intent).toEqual({
      kind: 'action',
      actionId: attack.id,
      target: { kind: 'unit', combatantId: 'enemy' },
    })
    if (followup.intent.kind !== 'action') throw new Error('Expected exactly affordable Rake.')
    const used = executePv1fSummonAbility(moved, active.summon, attack.id, followup.intent.target)
    expect(readPv1fActionEconomy(used.state)!.current).toBe(0)
    expect(used.events).toContainEqual(expect.objectContaining({ event: 'summon_ability_used' }))
  })

  it('round-trips neverMoves and rejects a malformed captured flag', () => {
    const active = summonTurn(50, summonProfile({ neverMoves: true }))
    const restored = JSON.parse(JSON.stringify(active.state)) as StatDrivenCombatEncounterState
    expect(restored.effectState?.summons?.[0]?.profile.neverMoves).toBe(true)
    expect(validateStatDrivenCombatEncounterState(restored)).toEqual([])
    const malformed = JSON.parse(JSON.stringify(restored))
    malformed.effectState.summons[0].profile.neverMoves = 'true'
    expect(validateStatDrivenCombatEncounterState(malformed)).toContainEqual(
      expect.objectContaining({ field: 'effectState.summons' }),
    )
  })

  it('moves toward an injured ally to make a support-only ability legal', () => {
    const heal = summonProfile().abilities[1]!
    const active = summonTurn(
      20,
      summonProfile({ abilities: [{ ...heal, target: { ...heal.target, maximumRange: 1 } }] }),
    )
    const state = {
      ...active.state,
      tactical: {
        ...active.state.tactical,
        placements: active.state.tactical.placements.map((row) =>
          row.combatantId === 'player'
            ? { ...row, position: { x: 3, y: 0 } }
            : row.combatantId === 'enemy'
              ? { ...row, position: { x: 0, y: 0 } }
              : row,
        ),
      },
    }
    const decision = chooseSummonAiDecision({ ...active, state, tieBreakSeed: 22 })
    expect(decision.intent).toEqual({
      kind: 'move',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    })
    if (decision.intent.kind !== 'move') throw new Error('Expected support positioning.')
    const moved = executePv1fMovement(state, decision.intent.path).state
    expect(
      chooseSummonAiDecision({ ...active, state: moved, tieBreakSeed: 23 }).intent,
    ).toMatchObject({
      kind: 'action',
      actionId: heal.id,
      target: { kind: 'unit', combatantId: 'player' },
    })
  })

  it('steps away from an adjacent enemy to respect an ability minimum range', () => {
    const attack = summonProfile().abilities[0]!
    const active = summonTurn(
      50,
      summonProfile({
        abilities: [{ ...attack, target: { ...attack.target, minimumRange: 2, maximumRange: 2 } }],
      }),
    )
    const state = {
      ...active.state,
      tactical: {
        ...active.state.tactical,
        placements: active.state.tactical.placements.map((row) =>
          row.combatantId === 'player'
            ? { ...row, position: { x: 3, y: 0 } }
            : row.combatantId === 'enemy'
              ? { ...row, position: { x: 2, y: 0 } }
              : row,
        ),
      },
    }
    expect(chooseSummonAiDecision({ ...active, state, tieBreakSeed: 22 }).intent).toEqual({
      kind: 'move',
      path: [
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ],
    })
  })

  it('passes deterministically from its summoned tile when neverMoves and no ability reaches', () => {
    const base = summonProfile().abilities[0]!
    const active = summonTurn(
      50,
      summonProfile({
        neverMoves: true,
        abilities: [{ ...base, target: { ...base.target, maximumRange: 1 } }],
      }),
    )
    const decision = chooseSummonAiDecision({ ...active, tieBreakSeed: 22 })
    expect(decision.intent.kind).toBe('face')
    expect(chooseSummonAiDecision({ ...active, tieBreakSeed: 22 })).toEqual(decision)
    if (decision.intent.kind !== 'face') throw new Error('Expected bounded pass.')
    const finished = finishPv1fTurn(active.state, decision.intent.facing)
    expect(finished.state.tactical.battle.currentTurn?.combatantId).toBe('player')
    expect(
      finished.state.tactical.placements.find(
        (row) => row.combatantId === active.summon.combatantId,
      )?.position,
    ).toEqual({ x: 1, y: 0 })
  })

  it('neverMoves rejects walking and independent Skill Move while retaining a legal ranged action', () => {
    const active = summonTurn(50, summonProfile({ neverMoves: true }))
    const path = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]
    expect(evaluatePv1fMovement(active.state, path).movement.legal).toBe(false)
    expect(
      evaluatePreparedCombatWalking(active.state, path, PV1F_COMBAT_CONTENT, {
        independentAllowance: true,
      }).movement.legal,
    ).toBe(false)
    expect(() => executePv1fMovement(active.state, path)).toThrow()
    expect(chosenAbility(chooseSummonAiDecision({ ...active, tieBreakSeed: 22 }))).toBe(
      'wildwarden.verdant-stalker.thorn-rake',
    )
  })

  it.each(['push', 'pull'] as const)('neverMoves rejects forced %s displacement', (direction) => {
    const active = summonTurn(50, summonProfile({ neverMoves: true }))
    const action: CombatActionDefinition = {
      id: 'test.anchor',
      version: 1,
      sourceType: 'test',
      tags: ['test'],
      target: {
        ...summonProfile().abilities[0]!.target,
        teamPolicy: 'ally',
        friendlyFire: 'allies-only',
        maximumRange: 4,
      },
      cost: { spendsAction: false, mp: 0 },
      requirements: [],
      effects: [{ type: 'displace', recipient: 'primary-unit', direction, distance: 1 }],
    }
    const state = finishPv1fTurn(active.state, 'east').state
    const result = executeCombatAction(
      state,
      action,
      { kind: 'unit', combatantId: active.summon.combatantId },
      PV1F_COMBAT_CONTENT,
    )
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'displacement_failed', reason: 'status-restricted' }),
    )
    expect(
      result.state.tactical.placements.find((row) => row.combatantId === active.summon.combatantId)
        ?.position,
    ).toEqual({ x: 1, y: 0 })
  })

  it('rejects self Rewind and blocks an incoming captured position return', () => {
    const active = summonTurn(50, summonProfile({ neverMoves: true }))
    const action: CombatActionDefinition = {
      id: 'test.anchor-rewind',
      version: 1,
      sourceType: 'test',
      tags: ['test'],
      target: {
        ...summonProfile().abilities[0]!.target,
        kind: 'self',
        minimumRange: 0,
        maximumRange: 0,
        teamPolicy: 'self',
        friendlyFire: 'allies-only',
      },
      cost: { spendsAction: false, mp: 0 },
      requirements: [],
      effects: [{ type: 'return-to-turn-start', recipient: 'actor', anchorMode: 'cast-position' }],
    }
    expect(
      evaluateCombatAction(active.state, action, { kind: 'self' }, PV1F_COMBAT_CONTENT).legal,
    ).toBe(false)
    const state = finishPv1fTurn(active.state, 'east').state
    const incoming = {
      ...action,
      target: { ...summonProfile().abilities[1]!.target },
      effects: [
        {
          type: 'return-to-turn-start' as const,
          recipient: 'primary-unit' as const,
          target: 'ally' as const,
          anchorMode: 'cast-position' as const,
        },
      ],
    }
    const result = executeCombatAction(
      state,
      incoming,
      { kind: 'unit', combatantId: active.summon.combatantId },
      PV1F_COMBAT_CONTENT,
    )
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'combatant_rewind_blocked',
        reason: 'rooted',
        combatantId: active.summon.combatantId,
      }),
    )
  })

  it('uses high AI for explicit current settings and preserves captured historical profiles', () => {
    const historical = summonTurn(50, summonProfile({ aiProfile: 'standard' }))
    expect(chooseSummonAiDecision({ ...historical, tieBreakSeed: 22 }).profileId).toBe(
      'recruit-standard-v2',
    )
    const current = summonTurn(50, summonProfile({ aiProfile: 'standard', neverMoves: false }))
    expect(chooseSummonAiDecision({ ...current, tieBreakSeed: 22 }).profileId).toBe(
      'recruit-high-v2',
    )
  })

  it('rejects harmful legal healing even when authored base utility is high', () => {
    const heal = summonProfile().abilities[1]!
    const active = summonTurn(
      50,
      summonProfile({
        neverMoves: true,
        abilities: [
          {
            ...heal,
            target: { ...heal.target, teamPolicy: 'enemy', friendlyFire: 'enemies-only' },
            ai: { ...heal.ai, baseUtility: 1000 },
          },
        ],
      }),
    )
    const state = {
      ...active.state,
      tactical: {
        ...active.state.tactical,
        battle: {
          ...active.state.tactical.battle,
          combatants: active.state.tactical.battle.combatants.map((row) =>
            row.id === 'enemy' ? { ...row, hp: 20 } : row,
          ),
        },
      },
    }
    expect(chooseSummonAiDecision({ ...active, state, tieBreakSeed: 22 }).intent.kind).toBe('face')
  })

  it('finishes its turn deterministically when no ability or movement is affordable', () => {
    const active = summonTurn(20)
    const state = spendPv1fActionEconomy(active.state, 85)
    const input = { state, summon: active.summon, tieBreakSeed: 45 }
    const decision = chooseSummonAiDecision(input)
    expect(chooseSummonAiDecision(input)).toEqual(decision)
    expect(decision.intent.kind).toBe('face')
    if (decision.intent.kind !== 'face') throw new Error('Expected final facing to end the turn.')
    const finished = finishPv1fTurn(state, decision.intent.facing)
    expect(finished.state.tactical.battle.currentTurn?.combatantId).toBe('player')
    expect(finished.events).not.toContainEqual(
      expect.objectContaining({ event: 'summon_ability_used' }),
    )
    expect(finished.state.effectState?.summons?.[0]?.turnsCompleted).toBe(1)
  })

  it('chooses healing over damage when a friendly target is meaningfully injured', () => {
    const { state, summon } = summonTurn(20)
    const decision = chooseSummonAiDecision({ state, summon, tieBreakSeed: 17 })

    expect(chosenAbility(decision)).toBe('wildwarden.verdant-stalker.verdant-mend')
    expect(decision.reason).toBe('recover-survival')
  })

  it('chooses damage when healing would produce no useful state change', () => {
    const { state, summon } = summonTurn(50)
    const decision = chooseSummonAiDecision({ state, summon, tieBreakSeed: 17 })

    expect(chosenAbility(decision)).toBe('wildwarden.verdant-stalker.thorn-rake')
    expect(decision.reason).toBe('legal-damage')
  })

  it('uses the tie-break seed deterministically when authored abilities are equally useful', () => {
    const equal = summonProfile({
      abilities: [
        {
          ...summonProfile().abilities[0]!,
          id: 'wildwarden.verdant-stalker.thorn-rake-a',
        },
        {
          ...summonProfile().abilities[0]!,
          id: 'wildwarden.verdant-stalker.thorn-rake-b',
        },
      ],
    })
    const first = summonTurn(50, equal)
    const second = summonTurn(50, equal)

    const a = chooseSummonAiDecision({
      state: first.state,
      summon: first.summon,
      tieBreakSeed: 911,
    })
    const b = chooseSummonAiDecision({
      state: second.state,
      summon: second.summon,
      tieBreakSeed: 911,
    })

    expect(chosenAbility(a)).not.toBeNull()
    expect(chosenAbility(b)).toBe(chosenAbility(a))
  })

  it('moves under normal movement authority until an authored ability is in legal range, then attacks', () => {
    const meleeOnly = summonProfile({
      abilities: [
        {
          ...summonProfile().abilities[0]!,
          target: {
            ...summonProfile().abilities[0]!.target,
            minimumRange: 1,
            maximumRange: 1,
          },
        },
      ],
    })
    const { state, summon } = summonTurn(50, meleeOnly)

    const first = chooseSummonAiDecision({ state, summon, tieBreakSeed: 301 })
    expect(first.intent.kind).toBe('move')
    if (first.intent.kind !== 'move') throw new Error('Expected summon movement.')

    const moved = executePv1fMovement(state, first.intent.path)
    const movedPlacement = moved.state.tactical.placements.find(
      (placement) => placement.combatantId === summon.combatantId,
    )
    expect(movedPlacement?.position).toEqual({ x: 2, y: 0 })

    const currentSummon = moved.state.effectState?.summons?.find(
      (row) => row.combatantId === summon.combatantId,
    )
    if (!currentSummon) throw new Error('Expected active summon after movement.')

    const second = chooseSummonAiDecision({
      state: moved.state,
      summon: currentSummon,
      tieBreakSeed: 302,
    })
    expect(second.intent).toMatchObject({
      kind: 'action',
      actionId: 'wildwarden.verdant-stalker.thorn-rake',
      target: { kind: 'unit', combatantId: 'enemy' },
    })
  })

  it('allows at most one authored ability per summon turn while leaving movement/facing/end available', () => {
    const { state, summon } = summonTurn(50)
    const first = chooseSummonAiDecision({ state, summon, tieBreakSeed: 44 })
    if (first.intent.kind !== 'action') throw new Error('Expected authored summon ability.')

    const executed = executePv1fSummonAbility(
      state,
      summon,
      first.intent.actionId,
      first.intent.target,
    )

    expect(readPv1fActionEconomy(executed.state, summon.combatantId)?.current).toBe(55)

    const next = chooseSummonAiDecision({
      state: executed.state,
      summon: executed.state.effectState!.summons!.find(
        (row) => row.combatantId === summon.combatantId,
      )!,
      tieBreakSeed: 45,
    })

    const nextActionId = next.intent.kind === 'action' ? next.intent.actionId : null
    expect(
      nextActionId !== null &&
        summon.profile.abilities.some((ability) => ability.id === nextActionId),
    ).toBe(false)
    expect(['move', 'face', 'end-turn']).toContain(next.intent.kind)
  })
})

it('uses a shared full cardinal lane for a versioned summon ability', () => {
  const base = summonProfile().abilities[0]!
  const profile = summonProfile({
    abilities: [
      {
        ...base,
        effects: [{ type: 'damage', recipient: 'affected-units', amount: 10 }],
        target: {
          ...base.target,
          geometryVersion: 2,
          shape: { kind: 'line', length: 3 },
          minimumRange: 0,
          maximumRange: 3,
        },
      },
    ],
  })
  const { state, summon } = summonTurn(50, profile)
  expect(chooseSummonAiDecision({ state, summon, tieBreakSeed: 17 }).intent).toMatchObject({
    kind: 'action',
    actionId: base.id,
    target: { kind: 'direction', direction: 'east' },
  })
})

it('quotes and pays summon Skill HP/MP/AP once, without mutating previews or permitting lethal costs', () => {
  const base = summonProfile()
  const ability = { ...base.abilities[0]!, hpCost: 35, mpCost: 3 }
  const { state, summon } = summonTurn(50, { ...base, abilities: [ability] })
  const before = JSON.stringify(state)
  const target = { kind: 'unit' as const, combatantId: 'enemy' }
  const quote = evaluatePv1fSummonAbility(state, summon, ability.id, target)
  expect(quote.evaluation.legal).toBe(true)
  expect(quote.evaluation.hpCost).toBe(35)
  expect(chooseSummonAiDecision({ state, summon, tieBreakSeed: 2 }).intent).toMatchObject({
    kind: 'action',
    actionId: ability.id,
  })
  const used = executePv1fSummonAbility(state, summon, ability.id, target)
  expect(
    used.state.tactical.battle.combatants.find((unit) => unit.id === summon.combatantId),
  ).toMatchObject({ hp: 1, mp: 9 })
  expect(readPv1fActionEconomy(used.state, summon.combatantId)?.current).toBe(
    readPv1fActionEconomy(quote.prepared, summon.combatantId)!.current - ability.apCost,
  )
  expect(
    used.events.filter(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        'event' in event &&
        event.event === 'hp_spent',
    ),
  ).toHaveLength(1)
  expect(JSON.stringify(state)).toBe(before)

  const lethal = summonTurn(50, { ...base, abilities: [{ ...ability, hpCost: 36 }] })
  const lethalBefore = JSON.stringify(lethal.state)
  expect(
    evaluatePv1fSummonAbility(lethal.state, lethal.summon, ability.id, target).evaluation.issues,
  ).toContainEqual(expect.objectContaining({ code: 'insufficient-hp' }))
  expect(() => executePv1fSummonAbility(lethal.state, lethal.summon, ability.id, target)).toThrow(
    /HP/,
  )
  expect(chooseSummonAiDecision({ ...lethal, tieBreakSeed: 2 }).intent.kind).not.toBe('action')
  expect(JSON.stringify(lethal.state)).toBe(lethalBefore)
})

it('uses Endure as a real summon ability and rejects damage while its window is active', () => {
  const base = summonProfile()
  const ability = {
    ...base.abilities[0]!,
    id: 'test.endure.summon',
    name: 'Endure',
    tags: ['support'],
    target: {
      ...base.abilities[0]!.target,
      kind: 'self' as const,
      teamPolicy: 'self' as const,
      minimumRange: 0,
      maximumRange: 0,
      friendlyFire: 'allies-only' as const,
    },
    effects: [
      {
        type: 'endure' as const,
        recipient: 'actor' as const,
        durationTurns: 2,
        releaseBasisPoints: 15000,
        radiusTiles: 3,
        targetTeams: 'enemies' as const,
      },
    ],
    ai: { baseUtility: 100, purposeTags: ['support'] },
  }
  const { state, summon } = summonTurn(50, { ...base, abilities: [ability, base.abilities[0]!] })
  const decision = chooseSummonAiDecision({ state, summon, tieBreakSeed: 45 })
  expect(decision.intent).toMatchObject({ kind: 'action', actionId: ability.id })
  const result = executePv1fSummonAbility(state, summon, ability.id, { kind: 'self' })
  const evaluated = evaluatePv1fSummonAbility(
    result.state as typeof state,
    summon,
    base.abilities[0]!.id,
    { kind: 'unit', combatantId: 'enemy' },
  )
  expect(evaluated.evaluation.legal).toBe(false)
  expect(evaluated.evaluation.issues).toContainEqual(
    expect.objectContaining({ code: 'endure-active' }),
  )
  const next = chooseSummonAiDecision({
    state: result.state as typeof state,
    summon,
    tieBreakSeed: 45,
  })
  expect(next.intent.kind !== 'action' || next.intent.actionId !== base.abilities[0]!.id).toBe(true)
  const ended = finishPv1fTurn(result.state as typeof state, 'west').state
  const removed = removeCombatSummon(ended as typeof state, summon.combatantId, 'expired')
  expect(removed.state.endureState?.applications).toEqual([])
})

function summonOnFrozenGround(reversal = false) {
  const base = summonProfile()
  const ability = reversal
    ? {
        ...base.abilities[0]!,
        tags: ['utility'],
        target: {
          ...base.abilities[0]!.target,
          kind: 'self' as const,
          teamPolicy: 'self' as const,
          minimumRange: 0,
          maximumRange: 0,
          friendlyFire: 'allies-only' as const,
        },
        effects: [
          {
            type: 'reversal' as const,
            recipient: 'actor' as const,
            version: 1 as const,
            family: 'physical' as const,
            reflectionBasisPoints: 10000,
            attackerMaxHpCapBasisPoints: 2000,
            defenderMaxHpCapBasisPoints: 2500,
          },
        ],
      }
    : base.abilities[0]!
  const active = summonTurn(50, { ...base, abilities: [ability] })
  return {
    ...active,
    ability,
    state: {
      ...active.state,
      frozenGroundPolicyVersion: 1 as const,
      terrainOverlays: [
        {
          kind: 'frozen' as const,
          frozenGroundPolicyVersion: 1 as const,
          position: active.state.tactical.placements.find(
            (row) => row.combatantId === active.summon.combatantId,
          )!.position,
          remainingRoundBoundaries: 2,
          sourceCombatantId: 'enemy',
          skillApSurcharge: 27,
        },
      ],
    },
  }
}
it.each([false, true])(
  'quotes and pays the Frozen Ground surcharge once for a Summon Skill (Reversal %s)',
  (reversal) => {
    const { state, summon, ability } = summonOnFrozenGround(reversal)
    const target = reversal
      ? { kind: 'self' as const }
      : { kind: 'unit' as const, combatantId: 'enemy' }
    const before = JSON.stringify(state)
    const quote = evaluatePv1fSummonAbility(state, summon, ability.id, target)
    expect(quote.evaluation.legal).toBe(true)
    expect(quote.cost).toBe(ability.apCost + 27)
    expect(JSON.stringify(state)).toBe(before)
    const used = executePv1fSummonAbility(state, summon, ability.id, target)
    expect(readPv1fActionEconomy(used.state, summon.combatantId)?.current).toBe(100 - quote.cost)
    expect(
      (used.events as { event: string }[]).filter(
        (event) => event.event === 'action_economy_spent',
      ),
    ).toEqual([expect.objectContaining({ amount: quote.cost, remaining: 100 - quote.cost })])
    const poor = spendPv1fActionEconomy(state, 100 - ability.apCost)
    expect(evaluatePv1fSummonAbility(poor, summon, ability.id, target).cost).toBe(quote.cost)
    expect(() => executePv1fSummonAbility(poor, summon, ability.id, target)).toThrow(/Economy|AP/)
  },
)
it.each([false, true])(
  'exempts friendly and Airborne Summon Skills and preserves historical Frozen costs (Reversal %s)',
  (reversal) => {
    const { state, summon, ability } = summonOnFrozenGround(reversal)
    const target = reversal
      ? { kind: 'self' as const }
      : { kind: 'unit' as const, combatantId: 'enemy' }
    const friendly = {
      ...state,
      terrainOverlays: state.terrainOverlays.map((row) => ({
        ...row,
        sourceCombatantId: 'player',
      })),
    }
    const airborne = {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId !== summon.combatantId
          ? row
          : {
              ...row,
              statuses: [
                ...row.statuses,
                {
                  statusId: 'airborne',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: summon.combatantId,
                },
              ],
            },
      ),
    }
    const historical = {
      ...state,
      terrainOverlays: state.terrainOverlays.map(({ skillApSurcharge: _profile, ...row }) => {
        void _profile
        return row
      }),
    }
    for (const exempt of [friendly, airborne, historical]) {
      expect(evaluatePv1fSummonAbility(exempt, summon, ability.id, target).cost).toBe(
        ability.apCost,
      )
      expect(
        readPv1fActionEconomy(
          executePv1fSummonAbility(exempt, summon, ability.id, target).state,
          summon.combatantId,
        )?.current,
      ).toBe(100 - ability.apCost)
    }
  },
)

it('keeps the native Summon Basic Attack exempt from Frozen Ground Skill AP', () => {
  const { state, summon } = summonOnFrozenGround()
  const adjacent = {
    ...state,
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements.map((row) =>
        row.combatantId === 'enemy' ? { ...row, position: { x: 2, y: 0 } } : row,
      ),
    },
  }
  const target = { kind: 'unit' as const, combatantId: 'enemy' }
  const quote = evaluatePv1fAction(adjacent, PV1F_BASIC_ATTACK_ID, target)
  expect(quote.evaluation.legal).toBe(true)
  expect(quote.cost).toBe(30)
  expect(
    readPv1fActionEconomy(
      executePv1fAction(adjacent, PV1F_BASIC_ATTACK_ID, target).state,
      summon.combatantId,
    )?.current,
  ).toBe(70)
})
