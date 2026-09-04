import type {
  BattleSessionCommitRecord,
  BattleSessionRepository,
  BattleSessionRecord,
  CommitBattleIntentInput,
  CreateBattleSessionInput,
} from '@aurevane/db/battle-session'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { moveCurrentCombatant } from '@aurevane/game-core/combat/board'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
import { readPv1fActionEconomy } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  resonanceSnapshotReference,
  resolveResonanceForPair,
} from '@aurevane/game-core/combat/resonance'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type {
  CharacterBuildRepository,
  CharacterCommittedBuildSnapshotRecord,
} from '@/server/character/character-build-service'

import {
  createBattleSessionService,
  type BattleAuthoritativeEncounterState,
} from './battle-session-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const CREATED_AT = '2026-09-04T03:45:00.000Z'
const PLAYER_ID = `character:${CHARACTER_ID}`

function characterRecord(): CharacterRecord {
  return {
    id: CHARACTER_ID,
    userId: USER_ID,
    slotIndex: 0,
    rulesVersion: 1,
    name: 'Wayfarer',
    nameKey: 'wayfarer',
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.roadworn',
    foundationDisciplineId: 'vanguard',
    might: 6,
    finesse: 6,
    vitality: 6,
    agility: 6,
    intellect: 6,
    resolve: 6,
    level: 1,
    xp: 0,
    progressionCycle: 1,
    createdAt: CREATED_AT,
    cycleStartedAt: CREATED_AT,
    lastActiveAt: CREATED_AT,
  }
}

function pureSnapshot(): CharacterCommittedBuildSnapshotRecord {
  const essence = resolveEssenceForBuild('vanguard', null)
  if (!essence) throw new Error('Expected representative Vanguard Essence.')
  return {
    schemaVersion: 2,
    buildVersion: 7,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: null,
    disciplineSkills: [],
    extensions: {
      resonance: null,
      essence: essenceSnapshotReference(essence),
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

function mixedSnapshot(): CharacterCommittedBuildSnapshotRecord {
  const resonance = resolveResonanceForPair('vanguard', 'lifebinder')
  return {
    schemaVersion: 2,
    buildVersion: 8,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: { disciplineId: 'lifebinder', definitionVersion: 1 },
    disciplineSkills: [],
    extensions: {
      resonance: resonance ? resonanceSnapshotReference(resonance) : null,
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

function characterRepository(): CharacterRepository {
  return {
    findByOwnerSlot: vi.fn(async () => characterRecord()),
    createBaseCharacter: vi.fn(async () => {
      throw new Error('Not used by the P3.6 battle authority test.')
    }),
  }
}

function buildRepository(initial: CharacterCommittedBuildSnapshotRecord) {
  let snapshot = initial
  const loadCommittedBuildSnapshot = vi.fn(async () => snapshot)
  const repository: CharacterBuildRepository = {
    findActiveBuild: vi.fn(async () => null),
    listDisciplines: vi.fn(async () => []),
    listLearnedSkills: vi.fn(async () => []),
    listEquippedDisciplineSkills: vi.fn(async () => []),
    loadCommittedBuildSnapshot,
    changeDisciplines: vi.fn(async () => {
      throw new Error('Not used by the P3.6 battle authority test.')
    }),
    saveDisciplineSkills: vi.fn(async () => {
      throw new Error('Not used by the P3.6 battle authority test.')
    }),
  }
  return {
    repository,
    loadCommittedBuildSnapshot,
    replace(next: CharacterCommittedBuildSnapshotRecord) {
      snapshot = next
    },
  }
}

function battleRepository() {
  let record: BattleSessionRecord | null = null
  const createBattleSession = vi.fn(async (input: CreateBattleSessionInput) => {
    const state = input.initialSnapshot as BattleAuthoritativeEncounterState
    record = {
      battleSessionId: SESSION_ID,
      battleId: input.battleId,
      battleVersion: 1,
      rulesVersion: input.rulesVersion,
      contentVersion: input.contentVersion,
      lifecycle: state.tactical.battle.lifecycle,
      snapshot: input.initialSnapshot,
      controlledCombatantIds: [PLAYER_ID],
      updatedAt: CREATED_AT,
    }
    return {
      replayed: false,
      result: {
        battleSessionId: SESSION_ID,
        battleVersion: 1,
        snapshot: input.initialSnapshot,
        createdAt: CREATED_AT,
      },
    }
  })
  const findBattleSession = vi.fn(async () => record)
  const findBattleIntentReplay = vi.fn(async (): Promise<BattleSessionCommitRecord | null> => null)
  const commitBattleIntent = vi.fn(async (input: CommitBattleIntentInput) => {
    if (!record) throw new Error('Expected an existing battle session.')
    record = {
      ...record,
      battleVersion: input.expectedBattleVersion + 1,
      snapshot: input.nextSnapshot,
      updatedAt: CREATED_AT,
    }
    return {
      replayed: false,
      result: {
        battleSessionId: input.battleSessionId,
        battleVersion: input.expectedBattleVersion + 1,
        snapshot: input.nextSnapshot,
        committedAt: CREATED_AT,
      },
    }
  })
  const repository: BattleSessionRepository = {
    createBattleSession,
    findBattleSession,
    findBattleIntentReplay,
    commitBattleIntent,
  }
  return {
    repository,
    createBattleSession,
    commitBattleIntent,
    get record() {
      return record
    },
    replaceSnapshot(snapshot: unknown) {
      if (!record) throw new Error('Expected an existing battle session.')
      record = { ...record, snapshot }
    },
  }
}

function positionPlayerAdjacent(state: BattleAuthoritativeEncounterState) {
  const positioned = moveCurrentCombatant(state.tactical, [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ])
  const base = reattachStatDrivenCombatBridge(
    createCombatEncounterState(positioned.state, state.statusState),
    state.statBridge,
  )
  return state.buildAuthority ? { ...base, buildAuthority: state.buildAuthority } : base
}

describe('P3.6 battle Essence authority', () => {
  it('pins the committed pure build and executes Essence through that battle-owned snapshot', async () => {
    const builds = buildRepository(pureSnapshot())
    const battles = battleRepository()
    const service = createBattleSessionService({
      characters: characterRepository(),
      battles: battles.repository,
      builds: builds.repository,
    })

    const created = await service.createSession({
      userId: USER_ID,
      characterId: CHARACTER_ID,
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
    })
    expect(created.snapshot.buildAuthority).toMatchObject({
      schemaVersion: 1,
      combatContext: 'pve',
      combatants: [
        {
          combatantId: PLAYER_ID,
          characterId: CHARACTER_ID,
          buildVersion: 7,
          primary: { disciplineId: 'vanguard' },
          secondary: null,
          extensions: {
            essence: {
              essenceId: 'essence.vanguard.unbroken-strike',
              skillId: 'essence.vanguard.unbroken-strike',
            },
          },
        },
      ],
    })

    const persisted = battles.record?.snapshot as BattleAuthoritativeEncounterState | undefined
    if (!persisted) throw new Error('Expected the persisted battle snapshot.')
    battles.replaceSnapshot(positionPlayerAdjacent(persisted))

    const result = await service.submitIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
      intent: {
        kind: 'action',
        actionId: 'essence.vanguard.unbroken-strike',
        target: { kind: 'unit', combatantId: 'recruit:p2-4-1' },
      },
    })

    const committed = battles.commitBattleIntent.mock.calls[0]?.[0]
    if (!committed) throw new Error('Expected the Essence battle commit.')
    const next = committed.nextSnapshot as BattleAuthoritativeEncounterState
    expect(readPv1fActionEconomy(next, PLAYER_ID)?.current).toBe(45)
    expect(next.tactical.battle.combatants.find((row) => row.id === 'recruit:p2-4-1')?.hp).toBe(60)
    expect(committed.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'skill_cooldown_started',
          actionId: 'essence.vanguard.unbroken-strike',
        }),
        expect.objectContaining({
          event: 'action_economy_spent',
          combatantId: PLAYER_ID,
          amount: 55,
          remaining: 45,
        }),
      ]),
    )
    expect(result.snapshot.buildAuthority).toEqual(created.snapshot.buildAuthority)
  })

  it('does not ghost-bind a later Profile build when the battle reconnects', async () => {
    const builds = buildRepository(pureSnapshot())
    const battles = battleRepository()
    const service = createBattleSessionService({
      characters: characterRepository(),
      battles: battles.repository,
      builds: builds.repository,
    })

    const created = await service.createSession({
      userId: USER_ID,
      characterId: CHARACTER_ID,
      idempotencyKey: '66666666-6666-4666-8666-666666666666',
    })
    builds.replace(mixedSnapshot())

    const reconnected = await service.getSession(USER_ID, SESSION_ID)
    expect(builds.loadCommittedBuildSnapshot).toHaveBeenCalledTimes(1)
    expect(reconnected.snapshot.buildAuthority).toEqual(created.snapshot.buildAuthority)
    expect(reconnected.snapshot.buildAuthority?.combatants[0]?.extensions.essence?.essenceId).toBe(
      'essence.vanguard.unbroken-strike',
    )
  })

  it('pins no Essence for a mixed build and rejects fabricated Essence actions before commit', async () => {
    const builds = buildRepository(mixedSnapshot())
    const battles = battleRepository()
    const service = createBattleSessionService({
      characters: characterRepository(),
      battles: battles.repository,
      builds: builds.repository,
    })

    const created = await service.createSession({
      userId: USER_ID,
      characterId: CHARACTER_ID,
      idempotencyKey: '77777777-7777-4777-8777-777777777777',
    })
    expect(created.snapshot.buildAuthority?.combatants[0]?.extensions.essence).toBeNull()

    const before = battles.record?.snapshot as BattleAuthoritativeEncounterState | undefined
    if (!before) throw new Error('Expected the mixed battle snapshot.')
    expect(readPv1fActionEconomy(before, PLAYER_ID)?.current).toBe(100)

    await expect(
      service.submitIntent({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        idempotencyKey: '88888888-8888-4888-8888-888888888888',
        intent: {
          kind: 'action',
          actionId: 'essence.vanguard.unbroken-strike',
          target: { kind: 'unit', combatantId: 'recruit:p2-4-1' },
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })

    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
    const after = battles.record?.snapshot as BattleAuthoritativeEncounterState | undefined
    expect(after ? readPv1fActionEconomy(after, PLAYER_ID)?.current : null).toBe(100)
  })
})
