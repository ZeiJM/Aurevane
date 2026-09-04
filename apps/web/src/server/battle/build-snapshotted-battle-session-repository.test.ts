import type { BattleSessionRepository, CreateBattleSessionInput } from '@aurevane/db/battle-session'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { readCombatBuildSnapshot } from '@aurevane/game-core/combat/build-snapshot'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

import type { CharacterBuildRepository } from '@/server/character/character-build-service'

import { createBuildSnapshottedBattleSessionRepository } from './build-snapshotted-battle-session-repository'

vi.mock('server-only', () => ({}))

const userId = '00000000-0000-4000-8000-000000003711'
const characterId = '00000000-0000-4000-8000-000000003712'
const combatantId = `character:${characterId}`

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.7-repository',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 73712,
      combatants: [
        {
          id: combatantId,
          teamId: 'players',
          initiative: 10,
          baseMovementBudget: 10,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
          temporaryResources: [],
        },
        {
          id: 'recruit:p3-7',
          teamId: 'opponents',
          initiative: 5,
          baseMovementBudget: 10,
          hp: 80,
          maxHp: 80,
          mp: 25,
          maxMp: 25,
          temporaryResources: [],
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
      { id: 'player-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      { id: 'recruit-ground', maxElevationStep: 1, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId,
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'player-ground',
      },
      {
        combatantId: 'recruit:p3-7',
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'recruit-ground',
      },
    ],
  })
  const profiles: StatDrivenCombatProfile[] = [
    {
      combatantId,
      provenance: { kind: 'character-derived', sourceId: combatantId, sourceRulesVersion: 1 },
      accuracy: 8_000,
      evasion: 1_000,
      armor: 20,
      ward: 10,
      jump: 1,
    },
    {
      combatantId: 'recruit:p3-7',
      provenance: { kind: 'scenario', sourceId: 'scenario:p3-7', sourceRulesVersion: 1 },
      accuracy: 7_000,
      evasion: 800,
      armor: 20,
      ward: 20,
      jump: 1,
    },
  ]
  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), profiles)
}

function builds(buildVersion = 7): CharacterBuildRepository {
  return {
    async findActiveBuild() {
      throw new Error('not used')
    },
    async listDisciplines() {
      throw new Error('not used')
    },
    async listLearnedSkills() {
      throw new Error('not used')
    },
    async listEquippedDisciplineSkills() {
      throw new Error('not used')
    },
    async loadCommittedBuildSnapshot() {
      return {
        schemaVersion: 2,
        buildVersion,
        primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
        secondary: null,
        disciplineSkills: [],
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
    },
    async changeDisciplines() {
      throw new Error('not used')
    },
    async saveDisciplineSkills() {
      throw new Error('not used')
    },
  }
}

function battleRepository(captured: CreateBattleSessionInput[]): BattleSessionRepository {
  return {
    async createBattleSession(input) {
      captured.push(input)
      return {
        replayed: false,
        result: {
          battleSessionId: '00000000-0000-4000-8000-000000003713',
          battleVersion: 1,
          snapshot: input.initialSnapshot,
          createdAt: '2026-09-04T00:00:00.000Z',
        },
      }
    },
    async findBattleSession() {
      return null
    },
    async findBattleIntentReplay() {
      return null
    },
    async commitBattleIntent() {
      throw new Error('not used')
    },
  }
}

function createInput(): CreateBattleSessionInput {
  return {
    actorKey: userId,
    idempotencyKey: '00000000-0000-4000-8000-000000003714',
    requestFingerprint: `sha256:${'b'.repeat(64)}`,
    userId,
    battleId: 'battle:p3.7-repository',
    rulesVersion: 2,
    contentVersion: 2,
    initialSnapshot: encounter(),
    participants: [
      { combatantId, participantRole: 'player', characterId },
      { combatantId: 'recruit:p3-7', participantRole: 'opponent', characterId: null },
    ],
  }
}

describe('P3.7 build-snapshotted Battle Hall repository', () => {
  it('freezes the committed build into the initial snapshot and creation fingerprint', async () => {
    const captured: CreateBattleSessionInput[] = []
    const repository = createBuildSnapshottedBattleSessionRepository({
      battles: battleRepository(captured),
      builds: builds(7),
    })

    await repository.createBattleSession(createInput())

    const persisted = captured[0]
    expect(persisted?.requestFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(persisted?.requestFingerprint).not.toBe(createInput().requestFingerprint)
    const snapshot = readCombatBuildSnapshot(
      persisted?.initialSnapshot as ReturnType<typeof encounter>,
      combatantId,
    )
    expect(snapshot?.sourceBuildVersion).toBe(7)
    expect(snapshot?.extensions.essence?.essenceId).toBe('essence.vanguard.unbroken-strike')
  })

  it('changes the creation fingerprint when the committed build version changes', async () => {
    const first: CreateBattleSessionInput[] = []
    const second: CreateBattleSessionInput[] = []
    await createBuildSnapshottedBattleSessionRepository({
      battles: battleRepository(first),
      builds: builds(7),
    }).createBattleSession(createInput())
    await createBuildSnapshottedBattleSessionRepository({
      battles: battleRepository(second),
      builds: builds(8),
    }).createBattleSession(createInput())

    expect(first[0]?.requestFingerprint).not.toBe(second[0]?.requestFingerprint)
  })
})