import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, endTurn, selectFinalFacing, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  advanceCombatSummonOwnerTurn,
  removeCombatSummon,
  spawnCombatSummon,
} from './combat-summons'
import {
  createCurrentStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfileV4,
} from './stat-driven-combat'
import { SUMMON_PROFILE_SCHEMA_VERSION, type SummonProfileDefinition } from './summon-content'

function profile(combatantId: string, team: 'players' | 'opponents'): StatDrivenCombatProfileV4 {
  return {
    combatantId,
    provenance: {
      kind: team === 'players' ? 'character-derived' : 'scenario',
      sourceId: team === 'players' ? 'character:test-player' : 'scenario:test-opponent',
      sourceRulesVersion: 4,
    },
    accuracy: 7000,
    evasion: 1000,
    armor: 8,
    ward: 8,
    jump: 1,
    physicalPower: 30,
    mysticPower: 24,
    level: 1,
    criticalChance: 0,
  }
}

function summonProfile(): SummonProfileDefinition {
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
      accuracy: 6800,
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
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 5, durationTurns: 0 }],
        ai: { baseUtility: 70, purposeTags: ['damage', 'pressure'] },
        media: {
          iconKey: 'summon-ability.wildwarden.verdant-stalker.thorn-rake.icon',
          audioCueKey: null,
          vfxKey: null,
        },
      },
    ],
  }
}

function encounter(): StatDrivenCombatEncounterState {
  const pending = createPendingBattle({
    battleId: 'battle:summon-runtime',
    rulesVersion: 1,
    contentVersion: 1,
    rngSeed: 44,
    combatants: [
      {
        id: 'player',
        teamId: 'players',
        initiative: 20,
        baseMovementBudget: 4,
        hp: 50,
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
    width: 3,
    height: 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 2, y: 0 }, elevation: 0, terrainId: 'open-ground' },
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
        position: { x: 2, y: 0 },
        facing: 'west',
        movementProfileId: 'enemy-ground',
      },
    ],
  })
  return createCurrentStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    profile('player', 'players'),
    profile('enemy', 'opponents'),
  ])
}

function spawn(state = encounter()) {
  return spawnCombatSummon(state, {
    ownerCombatantId: 'player',
    sourceSkillId: 'wildwarden.renewing-herbs',
    sourceSkillVersion: 5,
    profile: summonProfile(),
    position: { x: 1, y: 0 },
    facing: 'east',
  })
}

describe('Combat v5.1 summon runtime state', () => {
  it('atomically spawns a friendly summon on empty ground without changing current-round initiative', () => {
    const state = encounter()
    const beforeOrder = [...state.tactical.battle.initiativeOrder]
    const spawned = spawn(state)
    const event = spawned.events.find((entry) => entry.event === 'summon_spawned')
    if (!event || event.event !== 'summon_spawned') throw new Error('Expected summon spawn event.')

    const summonId = event.combatantId
    expect(spawned.state.tactical.battle.initiativeOrder).toEqual(beforeOrder)
    expect(spawned.state.tactical.battle.deferredInitiativeCombatantIds).toContain(summonId)
    expect(spawned.state.tactical.battle.combatants).toContainEqual(
      expect.objectContaining({
        id: summonId,
        teamId: 'players',
        kind: 'summon',
        hp: 36,
        maxHp: 36,
      }),
    )
    expect(spawned.state.tactical.placements).toContainEqual(
      expect.objectContaining({ combatantId: summonId, position: { x: 1, y: 0 } }),
    )
    expect(spawned.state.statBridge.combatants).toContainEqual(
      expect.objectContaining({ combatantId: summonId, physicalPower: 24, mysticPower: 18 }),
    )
    expect(spawned.state.effectState?.summons).toContainEqual(
      expect.objectContaining({
        combatantId: summonId,
        ownerCombatantId: 'player',
        sourceSkillId: 'wildwarden.renewing-herbs',
        sourceSkillVersion: 5,
        turnsCompleted: 0,
      }),
    )
  })

  it('rejects an occupied summon tile without mutating the encounter', () => {
    const state = encounter()
    const before = JSON.stringify(state)
    expect(() =>
      spawnCombatSummon(state, {
        ownerCombatantId: 'player',
        sourceSkillId: 'wildwarden.renewing-herbs',
        sourceSkillVersion: 5,
        profile: summonProfile(),
        position: { x: 2, y: 0 },
        facing: 'east',
      }),
    ).toThrow(/empty|occupied/i)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('adds the summon to deterministic initiative only when the next round begins', () => {
    const spawned = spawn()
    const spawnEvent = spawned.events.find((entry) => entry.event === 'summon_spawned')
    if (!spawnEvent || spawnEvent.event !== 'summon_spawned') throw new Error('Expected spawn.')
    const summonId = spawnEvent.combatantId

    let battle = selectFinalFacing(spawned.state.tactical.battle, 'east').state
    battle = endTurn(battle).state
    battle = selectFinalFacing(battle, 'west').state
    battle = endTurn(battle).state

    expect(battle.round).toBe(2)
    expect(battle.initiativeOrder).toContain(summonId)
    expect(battle.deferredInitiativeCombatantIds ?? []).not.toContain(summonId)
    expect(battle.currentTurn?.combatantId).toBe(summonId)
  })

  it('removes summon combat, placement, stat, and effect state together', () => {
    const spawned = spawn()
    const spawnEvent = spawned.events.find((entry) => entry.event === 'summon_spawned')
    if (!spawnEvent || spawnEvent.event !== 'summon_spawned') throw new Error('Expected spawn.')
    const summonId = spawnEvent.combatantId

    const removed = removeCombatSummon(spawned.state, summonId, 'expired')

    expect(removed.state.tactical.battle.combatants.some((row) => row.id === summonId)).toBe(false)
    expect(removed.state.tactical.placements.some((row) => row.combatantId === summonId)).toBe(
      false,
    )
    expect(removed.state.statBridge.combatants.some((row) => row.combatantId === summonId)).toBe(
      false,
    )
    expect(removed.state.effectState?.summons?.some((row) => row.combatantId === summonId)).toBe(
      false,
    )
    expect(removed.state.tactical.battle.deferredInitiativeCombatantIds ?? []).not.toContain(
      summonId,
    )
    expect(removed.events).toContainEqual(
      expect.objectContaining({ event: 'summon_expired', combatantId: summonId }),
    )
  })

  it('expires the summon after completing its fifth summon turn', () => {
    let transition = spawn()
    const spawnEvent = transition.events.find((entry) => entry.event === 'summon_spawned')
    if (!spawnEvent || spawnEvent.event !== 'summon_spawned') throw new Error('Expected spawn.')
    const summonId = spawnEvent.combatantId

    for (let turn = 1; turn <= 4; turn += 1) {
      transition = advanceCombatSummonOwnerTurn(transition.state, summonId)
      expect(
        transition.state.effectState?.summons?.find((row) => row.combatantId === summonId)
          ?.turnsCompleted,
      ).toBe(turn)
    }

    transition = advanceCombatSummonOwnerTurn(transition.state, summonId)
    expect(transition.state.tactical.battle.combatants.some((row) => row.id === summonId)).toBe(
      false,
    )
    expect(transition.events).toContainEqual(
      expect.objectContaining({ event: 'summon_expired', combatantId: summonId }),
    )
  })
})
