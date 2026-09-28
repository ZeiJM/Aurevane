import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  finishPv1fTurn,
  executePv1fMatureSkill,
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import { resolveMatureSkillVersion, type MatureSkillDefinition } from './mature-skills'
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
    battleId: 'battle:summon-action',
    rulesVersion: 1,
    contentVersion: 1,
    rngSeed: 88,
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

function summoningSkill(): MatureSkillDefinition {
  const base = resolveMatureSkillVersion('wildwarden.renewing-herbs')
  if (!base) throw new Error('Expected current Renewing Herbs.')

  return {
    ...base,
    apCost: 45,
    target: {
      kind: 'empty-tile',
      teamPolicy: 'ally',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 3,
      requiresLineOfSight: true,
      maximumElevationDifference: 0,
      friendlyFire: 'allies-only',
    },
    effects: [{ type: 'summon', recipient: 'selected-tile', durationTurns: 0 }],
    effectDescriptions: undefined,
    summonProfile: summonProfile(),
  }
}

describe('Combat v5.1 summon Skill execution', () => {
  it('spends AP exactly once and spawns the summon on a legal empty tile', () => {
    const skill = summoningSkill()
    const resolved = executePv1fMatureSkill(
      encounter(),
      skill,
      { kind: 'tile', position: { x: 1, y: 0 } },
      'pve',
    )

    expect(readPv1fActionEconomy(resolved.state, 'player')).toEqual({
      current: 55,
      maximum: 100,
    })

    const summonEvent = resolved.events.find(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        'event' in event &&
        event.event === 'summon_spawned',
    )
    expect(summonEvent).toEqual(
      expect.objectContaining({
        event: 'summon_spawned',
        ownerCombatantId: 'player',
        sourceSkillId: skill.id,
        sourceSkillVersion: skill.contentVersion,
      }),
    )

    const summon = resolved.state.effectState?.summons?.[0]
    expect(summon).toBeDefined()
    expect(resolved.state.tactical.battle.currentTurn?.combatantId).toBe('player')
    expect(resolved.state.tactical.battle.initiativeOrder).not.toContain(summon?.combatantId)
    expect(resolved.state.tactical.battle.deferredInitiativeCombatantIds).toContain(
      summon?.combatantId,
    )
  })

  it('fails occupied-tile legality before spending AP or spawning anything', () => {
    const skill = summoningSkill()
    const prepared = preparePv1fTurnEconomy(encounter())
    expect(readPv1fActionEconomy(prepared, 'player')?.current).toBe(100)

    expect(() =>
      executePv1fMatureSkill(prepared, skill, { kind: 'tile', position: { x: 2, y: 0 } }, 'pve'),
    ).toThrow(/empty|occupied|target/i)

    expect(readPv1fActionEconomy(prepared, 'player')?.current).toBe(100)
    expect(prepared.effectState?.summons ?? []).toHaveLength(0)
    expect(prepared.tactical.battle.combatants).toHaveLength(2)
  })

  it('advances lifetime only when the summon finishes its own turn and expires after turn five', () => {
    const skill = summoningSkill()
    let state = executePv1fMatureSkill(
      encounter(),
      skill,
      { kind: 'tile', position: { x: 1, y: 0 } },
      'pve',
    ).state
    const summonId = state.effectState?.summons?.[0]?.combatantId
    if (!summonId) throw new Error('Expected spawned summon.')

    let summonTurns = 0
    for (let safety = 0; safety < 30 && state.tactical.battle.lifecycle === 'active'; safety += 1) {
      const outgoing = state.tactical.battle.currentTurn?.combatantId
      if (!outgoing) throw new Error('Expected active turn.')

      const finished = finishPv1fTurn(state, outgoing === 'enemy' ? 'west' : 'east')
      state = finished.state

      if (outgoing === summonId) {
        summonTurns += 1
        const activeSummon = state.effectState?.summons?.find((row) => row.combatantId === summonId)
        if (summonTurns < 5) {
          expect(activeSummon?.turnsCompleted).toBe(summonTurns)
        } else {
          expect(activeSummon).toBeUndefined()
          expect(state.tactical.battle.combatants.some((row) => row.id === summonId)).toBe(false)
          expect(finished.events).toContainEqual(
            expect.objectContaining({ event: 'summon_expired', combatantId: summonId }),
          )
          break
        }
      }
    }

    expect(summonTurns).toBe(5)
  })
})
