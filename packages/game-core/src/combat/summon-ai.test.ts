import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, endTurn, selectFinalFacing, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import type { CombatSummonInstance } from './combat-effect-state'
import { spawnCombatSummon } from './combat-summons'
import {
  executePv1fMovement,
  executePv1fSummonAbility,
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import { chooseSummonAiDecision, type SummonAiDecision } from './summon-ai'
import {
  createCurrentStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfileV4,
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
