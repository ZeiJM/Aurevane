import type {
  BattleSessionRecord,
  BattleSessionRepository,
  CommitBattleIntentInput,
} from '@aurevane/db/battle-session'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import {
  attachCombatBuildBridge,
  readCombatBuildSnapshot,
  type CombatBuildSnapshot,
} from '@aurevane/game-core/combat/build-snapshot'
import { createPv1fTemporaryResources } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  copiedSkillApCost,
  copiedSkillCommandId,
} from '@aurevane/game-core/combat/combat-skill-copy'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createBattleBuildAuthoritySnapshot } from './battle-build-authority'
import type { CharacterCommittedBuildSnapshotRecord } from '../character/character-build-service'
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

function committedSnapshot(
  value: CombatBuildSnapshot,
): CharacterCommittedBuildSnapshotRecord {
  return {
    schemaVersion: value.sourceBuildSchemaVersion,
    buildVersion: value.sourceBuildVersion,
    primary: { ...value.primary },
    secondary: value.secondary ? { ...value.secondary } : null,
    disciplineSkills: value.disciplineSkills.map((skill) => ({ ...skill })),
    extensions: {
      resonance: value.extensions.resonance
        ? {
            ...value.extensions.resonance,
            disciplinePair: [...value.extensions.resonance.disciplinePair] as [string, string],
          }
        : null,
      essence: value.extensions.essence ? { ...value.extensions.essence } : null,
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
  it('uses an exact pinned temporary copied Skill at half AP through server authority', async () => {
    const copiedBase = resolveMatureSkillVersion('vanguard.cleave', 1)
    if (!copiedBase) throw new Error('Expected Cleave fixture.')
    const copied = { ...copiedBase, ai: { ...copiedBase.ai, baseUtility: 500 } }
    const aiSnapshot = snapshot()
    const playerSnapshot: CombatBuildSnapshot = {
      ...snapshot(),
      disciplineSkills: [
        {
          slotIndex: 1,
          skillId: copied.id,
          contentVersion: copied.contentVersion,
          sourceDisciplineId: copied.sourceDisciplineId,
        },
      ],
    }
    const base = encounter()
    const state: StatDrivenCombatEncounterState & { buildAuthority?: unknown } = {
      ...base,
      buildAuthority: createBattleBuildAuthoritySnapshot('pve', [
        { combatantId: AI_ID, characterId: AI_CHARACTER_ID, snapshot: committedSnapshot(aiSnapshot) },
        {
          combatantId: PLAYER_ID,
          characterId: PLAYER_CHARACTER_ID,
          snapshot: committedSnapshot(playerSnapshot),
        },
      ]),
      effectState: {
        ongoingRecovery: [],
        poison: [],
        bleed: [],
        burn: [],
        damageHistory: [],
        temporarySkills: [
          {
            combatantId: AI_ID,
            sourceCombatantId: PLAYER_ID,
            skillId: copied.id,
            contentVersion: copied.contentVersion,
          },
        ],
      },
    }
    const resolver: CombatContentResolver = {
      async resolveCurrentSkillDefinition(skillId) {
        return resolveMatureSkillVersion(skillId)
      },
      async resolvePinnedSkillDefinition(skillId, version) {
        if (skillId === copied.id && version === copied.contentVersion) return copied
        return resolveMatureSkillVersion(skillId, version)
      },
    }
    const fixture = repository(state)

    const result = await createBattleRecruitAiService(fixture.battles, resolver).runTurn({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
    })

    const copiedCommandId = copiedSkillCommandId(copied.id, copied.contentVersion)
    expect(fixture.commits[0]?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'combat_action_used',
          actionId: copiedCommandId,
          actorId: AI_ID,
        }),
        expect.objectContaining({
          event: 'action_economy_spent',
          combatantId: AI_ID,
          amount: copiedSkillApCost(copied, 'pve'),
        }),
      ]),
    )
    expect(result.snapshot.effectState?.temporarySkills).toContainEqual(
      expect.objectContaining({ combatantId: AI_ID, skillId: copied.id }),
    )
  })

})
