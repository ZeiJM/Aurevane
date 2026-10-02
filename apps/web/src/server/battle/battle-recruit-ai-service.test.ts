import type {
  BattleSessionRecord,
  BattleSessionRepository,
  CommitBattleIntentInput,
  CreateBattleSessionInput,
} from '@aurevane/db/battle-session'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import { P2_3_COMBAT_CONTENT, endCombatTurn } from '@aurevane/game-core/combat/actions'
import { selectCurrentFinalFacing } from '@aurevane/game-core/combat/board'
import { spawnCombatSummon } from '@aurevane/game-core/combat/combat-summons'
import {
  SUMMON_PROFILE_SCHEMA_VERSION,
  type SummonProfileDefinition,
} from '@aurevane/game-core/combat/summon-content'
import {
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  createBattleRecruitAiService,
  deriveRecruitTieBreakSeed,
} from './battle-recruit-ai-service'
import { battleSparringTeamCounts } from '@/components/battle/battle-runtime'
import { createBattleSessionService } from './battle-session-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const CREATED_AT = '2026-08-17T15:00:00.000Z'

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

function characterRepository(): CharacterRepository {
  return {
    findByOwnerSlot: vi.fn(async () => characterRecord()),
    createBaseCharacter: vi.fn(async () => {
      throw new Error('Not used by Recruit AI service tests.')
    }),
  }
}

async function initialEncounter(
  teams: { allyCount?: number; enemyCount?: number } = {},
): Promise<StatDrivenCombatEncounterState> {
  let initialSnapshot: unknown = null
  const repository: BattleSessionRepository = {
    createBattleSession: vi.fn(async (input: CreateBattleSessionInput) => {
      initialSnapshot = input.initialSnapshot
      return {
        replayed: false,
        result: {
          battleSessionId: SESSION_ID,
          battleVersion: 1,
          snapshot: input.initialSnapshot,
          createdAt: CREATED_AT,
        },
      }
    }),
    findBattleSession: vi.fn(async () => null),
    findBattleIntentReplay: vi.fn(async () => null),
    commitBattleIntent: vi.fn(async () => {
      throw new Error('Not used while creating Recruit AI fixture.')
    }),
  }
  const service = createBattleSessionService({
    characters: characterRepository(),
    battles: repository,
  })
  await service.createSession({
    userId: USER_ID,
    characterId: CHARACTER_ID,
    idempotencyKey: '44444444-4444-4444-8444-444444444444',
    ...(Object.keys(teams).length ? { arenaId: 'duel-yard' as const, ...teams } : {}),
  })
  if (!initialSnapshot) throw new Error('Expected an initial battle snapshot.')
  return initialSnapshot as StatDrivenCombatEncounterState
}

function advanceToRecruitTurn(
  state: StatDrivenCombatEncounterState,
): StatDrivenCombatEncounterState {
  const faced = selectCurrentFinalFacing(state.tactical, 'east')
  const withFacing = reattachStatDrivenCombatBridge(
    { ...state, tactical: faced.state },
    state.statBridge,
  )
  return endCombatTurn(withFacing, P2_3_COMBAT_CONTENT).state as StatDrivenCombatEncounterState
}

function summonProfile(): SummonProfileDefinition {
  return {
    schemaVersion: SUMMON_PROFILE_SCHEMA_VERSION,
    id: 'summon.test.service-stalker',
    name: 'Service Stalker',
    description: 'A test summon controlled through the authoritative AI service.',
    flavorLine: 'It moves only when the server commands it.',
    portraitKey: 'summon.test.service-stalker.portrait',
    tags: ['summon', 'test'],
    maxHp: 30,
    maxMp: 0,
    initiative: 100,
    movementBudget: 4,
    stats: {
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 1,
      physicalPower: 20,
      mysticPower: 20,
    },
    aiProfile: 'standard',
    aiPurposeTags: ['damage'],
    lifetimeTurns: 3,
    abilities: [
      {
        id: 'summon.test.service-stalker.strike',
        name: 'Stalker Strike',
        description: 'Strike an enemy through the summon-specific action path.',
        apCost: 45,
        mpCost: 0,
        tags: ['attack'],
        target: {
          kind: 'unit',
          teamPolicy: 'enemy',
          shape: { kind: 'single' },
          minimumRange: 1,
          maximumRange: 99,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          friendlyFire: 'enemies-only',
        },
        requirements: [],
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 3, durationTurns: 0 }],
        ai: { baseUtility: 1_000, purposeTags: ['damage'] },
        media: { iconKey: null, audioCueKey: null, vfxKey: null },
      },
    ],
  }
}

function stateWithActiveSummonTurn(state: StatDrivenCombatEncounterState): {
  state: StatDrivenCombatEncounterState
  summonId: string
} {
  const occupied = new Set(
    state.tactical.placements.map((placement) => `${placement.position.x},${placement.position.y}`),
  )
  const position = state.tactical.tiles.find(
    (tile) =>
      !occupied.has(`${tile.position.x},${tile.position.y}`) &&
      state.tactical.terrains.some(
        (terrain) => terrain.id === tile.terrainId && terrain.traversalCost !== null,
      ),
  )?.position
  if (!position) throw new Error('Expected an empty passable tile for summon service test.')

  const ownerCombatantId = state.tactical.battle.currentTurn?.combatantId
  if (!ownerCombatantId) throw new Error('Expected player turn before summon spawn.')

  const spawned = spawnCombatSummon(state, {
    ownerCombatantId,
    sourceSkillId: 'test.summon-service',
    sourceSkillVersion: 1,
    profile: summonProfile(),
    position,
    facing: 'east',
  })
  const summonId = spawned.events.find((event) => event.event === 'summon_spawned')?.combatantId
  if (!summonId) throw new Error('Expected summon spawn event.')

  const recruitTurn = advanceToRecruitTurn(spawned.state)
  const summonTurn = advanceToRecruitTurn(recruitTurn)
  if (summonTurn.tactical.battle.currentTurn?.combatantId !== summonId) {
    throw new Error('Expected deferred summon to lead the next round.')
  }

  return { state: summonTurn, summonId }
}

function createStatefulRepository(
  initialState: StatDrivenCombatEncounterState,
  initialVersion = 1,
) {
  let version = initialVersion
  let state = initialState
  const commits: CommitBattleIntentInput[] = []

  const findBattleSession = vi.fn(async (): Promise<BattleSessionRecord> => ({
    battleSessionId: SESSION_ID,
    battleId: state.tactical.battle.battleId,
    battleVersion: version,
    rulesVersion: state.tactical.battle.rulesVersion,
    contentVersion: state.tactical.battle.contentVersion,
    lifecycle: state.tactical.battle.lifecycle,
    snapshot: state,
    controlledCombatantIds: [`character:${CHARACTER_ID}`],
    updatedAt: CREATED_AT,
  }))
  const findBattleIntentReplay = vi.fn(async () => null)

  const commitBattleIntent = vi.fn(async (input: CommitBattleIntentInput) => {
    if (input.expectedBattleVersion !== version) throw new Error('Unexpected stale fixture commit.')
    commits.push(input)
    version += 1
    state = input.nextSnapshot as StatDrivenCombatEncounterState
    return {
      replayed: false,
      result: {
        battleSessionId: SESSION_ID,
        battleVersion: version,
        snapshot: state,
        committedAt: `2026-08-17T15:00:0${Math.min(version, 9)}.000Z`,
      },
    }
  })

  const repository: BattleSessionRepository = {
    createBattleSession: vi.fn(async () => {
      throw new Error('Not used by Recruit AI runner tests.')
    }),
    findBattleSession,
    findBattleIntentReplay,
    commitBattleIntent,
  }

  return { repository, commits, findBattleSession, commitBattleIntent, currentState: () => state }
}

describe('P2.6 authoritative Recruit AI turn service', () => {
  it.each([
    [0, 5],
    [1, 4],
    [2, 3],
  ])(
    'resolves consecutive allied/enemy AI turns for %s allies and %s enemies',
    async (allyCount, enemyCount) => {
      const initial = await initialEncounter({ allyCount, enemyCount })
      const adjacent = {
        ...initial,
        tactical: {
          ...initial.tactical,
          battle: {
            ...initial.tactical.battle,
            combatants: initial.tactical.battle.combatants.map((c) => ({
              ...c,
              hp: 10_000,
              maxHp: 10_000,
            })),
          },
          placements: initial.tactical.placements.map((placement, index) => ({
            ...placement,
            position: { x: index, y: 3 },
          })),
        },
      }
      const state = advanceToRecruitTurn(adjacent)
      const fixture = createStatefulRepository(state),
        service = createBattleRecruitAiService(fixture.repository)
      let version = 1
      const acted = new Set<string>()
      let damageEvents = 0
      for (let request = 0; request < 5; request++) {
        const actor = fixture.currentState().tactical.battle.currentTurn?.combatantId
        expect(actor).not.toBe(`character:${CHARACTER_ID}`)
        const result = await service.runTurn({
          userId: USER_ID,
          battleSessionId: SESSION_ID,
          expectedBattleVersion: version,
        })
        expect(result.decisions.length).toBeGreaterThan(0)
        expect(result.decisions.every((d) => d.combatantId === actor)).toBe(true)
        expect(result.snapshot.tactical.battle.currentTurn?.combatantId).not.toBe(actor)
        for (const commit of fixture.commits.slice(-result.decisions.length)) {
          for (const event of commit.events) {
            if (
              event &&
              typeof event === 'object' &&
              'event' in event &&
              event.event === 'damage_applied' &&
              'sourceCombatantId' in event &&
              'targetCombatantId' in event
            ) {
              const source = state.tactical.battle.combatants.find(
                (c) => c.id === event.sourceCombatantId,
              )
              const target = state.tactical.battle.combatants.find(
                (c) => c.id === event.targetCombatantId,
              )
              expect(source).toBeDefined()
              expect(target).toBeDefined()
              expect(target!.teamId).not.toBe(source!.teamId)
              damageEvents++
            }
          }
        }
        acted.add(actor!)
        version = result.battleVersion
        if (result.snapshot.tactical.battle.lifecycle !== 'active') break
      }
      expect(damageEvents).toBeGreaterThan(0)
      expect(acted.size).toBe(5)
      expect(fixture.currentState().tactical.battle.currentTurn?.combatantId).toBe(
        `character:${CHARACTER_ID}`,
      )
      expect([...acted].filter((id) => id.startsWith('recruit:ally-'))).toHaveLength(allyCount)
    },
  )
  it('preserves original Sparring counts when a combat summon is still in the snapshot', async () => {
    const state = await initialEncounter({ allyCount: 2, enemyCount: 3 })
    const spawned = spawnCombatSummon(state, {
      ownerCombatantId: `character:${CHARACTER_ID}`,
      sourceSkillId: 'test.rematch-summon',
      sourceSkillVersion: 1,
      profile: summonProfile(),
      position: { x: 0, y: 0 },
      facing: 'east',
    })
    expect(
      battleSparringTeamCounts({
        battleSessionId: SESSION_ID,
        battleVersion: 1,
        snapshot: spawned.state,
        replayed: false,
        invalidation: null,
      }),
    ).toEqual({ allyCount: 2, enemyCount: 3 })
  })
  it('derives deterministic tie-break seeds only from committed battle metadata', () => {
    const committedContext = {
      battleId: 'battle:test',
      round: 2,
      turnNumber: 5,
      battleVersion: 7,
      step: 0,
      combatantId: 'recruit:test',
    }

    const seed = deriveRecruitTieBreakSeed(committedContext)

    expect(seed).toBe(-578_671_629)
    expect(deriveRecruitTieBreakSeed({ ...committedContext })).toBe(seed)
    expect(deriveRecruitTieBreakSeed({ ...committedContext, step: 1 })).not.toBe(seed)
    expect(deriveRecruitTieBreakSeed({ ...committedContext, battleVersion: 8 })).not.toBe(seed)
  })

  it('commits a bounded legal Recruit sequence and returns authority to the player', async () => {
    const playerState = await initialEncounter()
    const recruitState = advanceToRecruitTurn(playerState)
    expect(recruitState.tactical.battle.currentTurn?.combatantId).toBe('recruit:p2-4-1')

    const fixture = createStatefulRepository(recruitState)
    const service = createBattleRecruitAiService(fixture.repository)
    const result = await service.runTurn({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
    })

    expect(result.decisions.length).toBeGreaterThan(0)
    expect(result.decisions.length).toBeLessThanOrEqual(8)
    expect(result.snapshot.tactical.battle.currentTurn?.combatantId).toBe(
      `character:${CHARACTER_ID}`,
    )
    expect(result.snapshot.tactical.battle).not.toHaveProperty('rng')
    expect(fixture.commits).toHaveLength(result.decisions.length)

    for (const commit of fixture.commits) {
      const decision = commit.events.find(
        (event) =>
          typeof event === 'object' &&
          event !== null &&
          'event' in event &&
          event.event === 'recruit_ai_decision',
      )
      expect(decision).toMatchObject({
        event: 'recruit_ai_decision',
        combatantId: 'recruit:p2-4-1',
        profileId: 'recruit-high-v2',
        profileVersion: 2,
        rulesVersion: 2,
      })
      expect(JSON.stringify(decision)).not.toContain('tieBreakSeed')
      expect(JSON.stringify(decision)).not.toContain('rng')
      expect(commit.requestFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    }
  })

  it('routes summon turns through authored summon AI and returns control after the summon turn', async () => {
    const active = stateWithActiveSummonTurn(await initialEncounter())
    const fixture = createStatefulRepository(active.state)
    const service = createBattleRecruitAiService(fixture.repository)

    const result = await service.runTurn({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
    })

    expect(result.decisions.length).toBeGreaterThan(0)
    expect(result.snapshot.tactical.battle.currentTurn?.combatantId).toBe(
      `character:${CHARACTER_ID}`,
    )
    expect(
      fixture.commits.some((commit) =>
        commit.events.some(
          (event) =>
            typeof event === 'object' &&
            event !== null &&
            'event' in event &&
            event.event === 'summon_ai_decision',
        ),
      ),
    ).toBe(true)
    expect(
      fixture.commits.some((commit) =>
        commit.events.some(
          (event) =>
            typeof event === 'object' &&
            event !== null &&
            'event' in event &&
            event.event === 'summon_ability_used',
        ),
      ),
    ).toBe(true)

    const summon = result.snapshot.effectState?.summons?.find(
      (candidate) => candidate.combatantId === active.summonId,
    )
    expect(summon?.turnsCompleted).toBe(1)
  })

  it('rejects attempts to run Recruit AI during a player-controlled turn', async () => {
    const state = await initialEncounter()
    const fixture = createStatefulRepository(state)
    const service = createBattleRecruitAiService(fixture.repository)

    await expect(
      service.runTurn({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(fixture.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('fails stale requests before choosing or committing an AI decision', async () => {
    const state = advanceToRecruitTurn(await initialEncounter())
    const fixture = createStatefulRepository(state, 4)
    const service = createBattleRecruitAiService(fixture.repository)

    await expect(
      service.runTurn({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 2,
      }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION', currentVersion: 4 })
    expect(fixture.commitBattleIntent).not.toHaveBeenCalled()
  })
})
