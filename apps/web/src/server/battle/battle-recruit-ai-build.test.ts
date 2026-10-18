import type {
  BattleSessionRecord,
  BattleSessionRepository,
  CommitBattleIntentInput,
} from '@aurevane/db/battle-session'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import {
  attachCombatBuildBridge,
  readCombatBuildSnapshot,
  type CombatBuildSnapshot,
} from '@aurevane/game-core/combat/build-snapshot'
import { createPv1fTemporaryResources } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createBattleRecruitAiService } from './battle-recruit-ai-service'

const USER_ID = '00000000-0000-4000-8000-000000003741'
const SESSION_ID = '00000000-0000-4000-8000-000000003742'
const AI_CHARACTER_ID = '00000000-0000-4000-8000-000000003743'
const PLAYER_CHARACTER_ID = '00000000-0000-4000-8000-000000003744'
const AI_ID = `character:${AI_CHARACTER_ID}`
const PLAYER_ID = `character:${PLAYER_CHARACTER_ID}`
const CREATED_AT = '2026-09-04T03:40:00.000Z'

function snapshot(): CombatBuildSnapshot {
  return {
    schemaVersion: 1,
    sourceBuildSchemaVersion: 2,
    sourceBuildVersion: 12,
    fingerprint: `sha256:${'d'.repeat(64)}`,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: null,
    disciplineSkills: [
      {
        slotIndex: 1,
        skillId: 'vanguard.forceful-strike',
        contentVersion: 2,
        sourceDisciplineId: 'vanguard',
      },
    ],
    extensions: {
      resonance: null,
      essence: {
        essenceId: 'essence.vanguard.unbroken-strike',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
        skillId: 'essence.vanguard.unbroken-strike',
        skillContentVersion: 1,
      },
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

function encounter(): StatDrivenCombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.7-live-ai-build',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 73741,
      combatants: [
        {
          id: AI_ID,
          teamId: 'opponents',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 40,
          maxMp: 40,
          temporaryResources: createPv1fTemporaryResources(16),
        },
        {
          id: PLAYER_ID,
          teamId: 'players',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 50,
          maxHp: 50,
          mp: 30,
          maxMp: 30,
          temporaryResources: createPv1fTemporaryResources(16),
        },
      ],
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 2,
    height: 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
    ],
    movementProfiles: [
      { id: 'ai-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      { id: 'player-ground', maxElevationStep: 1, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId: AI_ID,
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'ai-ground',
      },
      {
        combatantId: PLAYER_ID,
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'player-ground',
      },
    ],
  })
  const profiles: StatDrivenCombatProfile[] = [
    {
      combatantId: AI_ID,
      provenance: { kind: 'character-derived', sourceId: AI_ID, sourceRulesVersion: 1 },
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 1,
    },
    {
      combatantId: PLAYER_ID,
      provenance: { kind: 'character-derived', sourceId: PLAYER_ID, sourceRulesVersion: 1 },
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 1,
    },
  ]
  return attachCombatBuildBridge(
    createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), profiles),
    [{ combatantId: AI_ID, characterId: AI_CHARACTER_ID, snapshot: snapshot() }],
  )
}

function repository(initial: StatDrivenCombatEncounterState) {
  let state = initial
  let version = 1
  const commits: CommitBattleIntentInput[] = []
  const findBattleSession = vi.fn(async (): Promise<BattleSessionRecord> => ({
    battleSessionId: SESSION_ID,
    battleId: state.tactical.battle.battleId,
    battleVersion: version,
    rulesVersion: state.tactical.battle.rulesVersion,
    contentVersion: state.tactical.battle.contentVersion,
    lifecycle: state.tactical.battle.lifecycle,
    snapshot: state,
    controlledCombatantIds: [PLAYER_ID],
    updatedAt: CREATED_AT,
  }))
  const commitBattleIntent = vi.fn(async (input: CommitBattleIntentInput) => {
    commits.push(input)
    version += 1
    state = input.nextSnapshot as StatDrivenCombatEncounterState
    return {
      replayed: false,
      result: {
        battleSessionId: SESSION_ID,
        battleVersion: version,
        snapshot: state,
        committedAt: CREATED_AT,
      },
    }
  })
  const battles: BattleSessionRepository = {
    createBattleSession: vi.fn(async () => {
      throw new Error('not used')
    }),
    findBattleSession,
    findBattleIntentReplay: vi.fn(async () => null),
    commitBattleIntent,
  }
  return { battles, commits, currentState: () => state }
}

describe('P3.7 live Recruit AI shared build snapshot', () => {
  it('uses the frozen Essence and keeps the same snapshot through the completed AI turn', async () => {
    const fixture = repository(encounter())
    const result = await createBattleRecruitAiService(fixture.battles).runTurn({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
    })

    expect(result.snapshot.tactical.battle.currentTurn?.combatantId).toBe(PLAYER_ID)
    expect(fixture.commits[0]?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'combat_action_used',
          actionId: 'essence.vanguard.unbroken-strike',
          actorId: AI_ID,
        }),
        expect.objectContaining({
          event: 'action_economy_spent',
          combatantId: AI_ID,
          amount: 55,
          remaining: 45,
        }),
      ]),
    )
    expect(readCombatBuildSnapshot(fixture.currentState(), AI_ID)?.fingerprint).toBe(
      snapshot().fingerprint,
    )
  })
})

it.each([7, 9])(
  'returns a bounded committed page for %i cheap Controlled actions without ending the turn early',
  async (count) => {
    const initial = { ...encounter(), buildBridge: undefined }
    const sources = Array.from({ length: count }, (_, index) =>
      captureCombatAbilitySource({
        schemaVersion: 1,
        sourceInstanceId: `test.controlled-source-${index}`,
        ownerCombatantId: AI_ID,
        abilityId: `test.controlled-${index}`,
        contentVersion: 1,
        sourceKind: 'discipline-skill',
        sourceDisciplineId: 'vanguard',
        tags: ['attack'],
        definition: {
          schemaVersion: 1,
          behaviors: [
            {
              id: 'strike',
              activation: 'manual',
              mode: 'action',
              classification: 'attack',
              attackFamily: 'physical',
              // Seven releases leave one Basic attack, making final facing step16.
              costs: [{ resource: 'ap', amount: count === 7 ? 7 : 1 }],
              cooldown: null,
              requirements: null,
              activationLimits: ['once-per-battle'],
              targeting: {
                kind: 'unit',
                teamPolicy: 'enemy',
                friendlyFire: 'enemies-only',
                shape: { kind: 'single' },
                minimumRange: 1,
                maximumRange: 1,
                maximumSelections: 1,
                maximumElevationDifference: null,
                requiresLineOfSight: false,
              },
              accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
              effects: [
                {
                  id: 'hit',
                  timing: 'controlled',
                  payload: {
                    type: 'damage',
                    recipient: 'primary-unit',
                    amount: 20,
                  },
                },
              ],
            },
          ],
        },
      }),
    )
    const state = reconcileCombatAbilitySources(
      {
        ...initial,
        tactical: {
          ...initial.tactical,
          battle: {
            ...initial.tactical.battle,
            combatants: initial.tactical.battle.combatants.map((unit) =>
              unit.id === PLAYER_ID ? { ...unit, hp: 10000, maxHp: 10000 } : unit,
            ),
          },
        },
      },
      sources,
    ) as StatDrivenCombatEncounterState
    const fixture = repository(JSON.parse(JSON.stringify(state)))
    const service = createBattleRecruitAiService(fixture.battles)
    const first = await service.runTurn({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
    })
    expect(fixture.commits).toHaveLength(16)
    expect(first.battleVersion).toBe(17)
    if (count === 9) {
      expect(first.snapshot.tactical.battle.currentTurn?.combatantId).toBe(AI_ID)
      expect(first.snapshot.tactical.battle.turnNumber).toBe(state.tactical.battle.turnNumber)
      expect(first.decisions).toHaveLength(8)
      expect(fixture.currentState().abilityRuntime!.controlled!.used).toHaveLength(8)
    } else expect(first.snapshot.tactical.battle.currentTurn?.combatantId).toBe(PLAYER_ID)
    const second =
      count === 9
        ? await service.runTurn({
            userId: USER_ID,
            battleSessionId: SESSION_ID,
            expectedBattleVersion: first.battleVersion,
          })
        : first
    expect(fixture.commits.length - 16).toBeLessThanOrEqual(16)
    expect(second.snapshot.tactical.battle.currentTurn?.combatantId).toBe(PLAYER_ID)
    expect(fixture.currentState().abilityRuntime!.controlled!.used).toHaveLength(count)
    const actions = fixture.commits
      .flatMap((commit) => commit.events)
      .filter((event) => (event as { event: string }).event === 'combat_action_used') as {
      actionId: string
    }[]
    for (const source of sources)
      expect(actions.filter((event) => event.actionId === source.abilityId)).toHaveLength(1)
    expect(JSON.stringify(first)).not.toMatch(
      /capturedAbilitySources|returnAnchor|prepare-controlled/,
    )
  },
)
