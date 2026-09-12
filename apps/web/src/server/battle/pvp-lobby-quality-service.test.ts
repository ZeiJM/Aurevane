import type { CharacterRecord } from '@aurevane/db/character'
import type { BattleSessionRecord, BattleSessionRepository } from '@aurevane/db/battle-session'
import { readCombatBuildSnapshot } from '@aurevane/game-core/combat/build-snapshot'
import { surrenderPvpCombatant, timeoutPvpTurn } from '@aurevane/game-core/combat/pvp-quality'
import { readPv1fActionEconomy } from '@aurevane/game-core/combat/pv1f-action-economy'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  groundSkill: false,
  createdBattleArgs: null as Record<string, unknown> | null,
}))

vi.mock('server-only', () => ({}))

const hostUserId = '00000000-0000-4000-8000-000000003721'
const guestUserId = '00000000-0000-4000-8000-000000003722'
const hostCharacterId = '00000000-0000-4000-8000-000000003723'
const guestCharacterId = '00000000-0000-4000-8000-000000003724'
const lobbyId = '00000000-0000-4000-8000-000000003725'

function character(id: string, userId: string, name: string): CharacterRecord {
  return {
    id,
    userId,
    slotIndex: 0,
    rulesVersion: 1,
    name,
    nameKey: name.toLowerCase(),
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.roadworn',
    foundationDisciplineId: 'vanguard',
    might: 7,
    finesse: 6,
    vitality: 5,
    agility: 6,
    intellect: 5,
    resolve: 7,
    level: 12,
    xp: 100,
    progressionCycle: 1,
    createdAt: '2026-09-04T00:00:00.000Z',
    cycleStartedAt: '2026-09-04T00:00:00.000Z',
    lastActiveAt: '2026-09-04T00:00:00.000Z',
  }
}

const characters = new Map([
  [hostCharacterId, character(hostCharacterId, hostUserId, 'Host')],
  [guestCharacterId, character(guestCharacterId, guestUserId, 'Guest')],
])

vi.mock('@/server/character/supabase-character-repository', () => ({
  createSupabaseCharacterRepository: () => ({
    findByOwnerId: async (userId: string, characterId: string) => {
      const row = characters.get(characterId) ?? null
      return row?.userId === userId ? row : null
    },
  }),
}))

vi.mock('@/server/character/supabase-character-build-repository', () => ({
  createSupabaseCharacterBuildRepository: () => ({
    loadCommittedBuildSnapshot: async (_userId: string, characterId: string) => {
      if (characterId === hostCharacterId) {
        return {
          schemaVersion: mocks.groundSkill ? 3 : 2,
          buildVersion: 3,
          primary: {
            disciplineId: mocks.groundSkill ? 'frostweaver' : 'vanguard',
            definitionVersion: 1,
            profileVersion: 1,
          },
          secondary: null,
          disciplineSkills: mocks.groundSkill
            ? [
                {
                  slotIndex: 1,
                  skillId: 'frostweaver.chilling-mist',
                  contentVersion: 2,
                  sourceDisciplineId: 'frostweaver',
                },
              ]
            : [],
          extensions: {
            resonance: null,
            essence: {
              essenceId: mocks.groundSkill
                ? 'essence.frostweaver.absolute-winter'
                : 'essence.vanguard.unbroken-strike',
              contentVersion: 1,
              sourceDisciplineId: mocks.groundSkill ? 'frostweaver' : 'vanguard',
              skillId: mocks.groundSkill
                ? 'essence.frostweaver.absolute-winter'
                : 'essence.vanguard.unbroken-strike',
              skillContentVersion: 1,
            },
            equipmentSkills: [],
            supernatural: null,
            prestige: null,
          },
        }
      }
      return {
        schemaVersion: 2,
        buildVersion: 4,
        primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
        secondary: { disciplineId: 'lifebinder', definitionVersion: 1 },
        disciplineSkills: [
          {
            slotIndex: 1,
            skillId: 'lifebinder.barrier',
            contentVersion: 1,
            sourceDisciplineId: 'lifebinder',
          },
        ],
        extensions: {
          resonance: {
            resonanceId: 'resonance.lifebinder-vanguard.mercys-edge',
            contentVersion: 1,
            disciplinePair: ['lifebinder', 'vanguard'],
          },
          essence: null,
          equipmentSkills: [],
          supernatural: null,
          prestige: null,
        },
      }
    },
  }),
}))

vi.mock('./pvp-lobby-service', () => ({
  getPvpLobby: async () => ({
    lobbyId,
    lobbyKey: 'P37TEST',
    mode: '1v1',
    ownerUserId: hostUserId,
    teamSizes: [1, 1, 0],
    status: 'waiting',
    battleSessionId: null,
    battleKey: null,
    readyToStart: true,
    members: [
      {
        userId: hostUserId,
        characterId: hostCharacterId,
        characterName: 'Host',
        characterLevel: 12,
        portraitRef: 'portrait.starter.wayfarer-01',
        profileImageUrl: null,
        teamIndex: 0,
        seatIndex: 0,
        seated: true,
        ready: true,
        isHost: true,
      },
      {
        userId: guestUserId,
        characterId: guestCharacterId,
        characterName: 'Guest',
        characterLevel: 12,
        portraitRef: 'portrait.starter.wayfarer-01',
        profileImageUrl: null,
        teamIndex: 1,
        seatIndex: 0,
        seated: true,
        ready: true,
        isHost: false,
      },
    ],
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'get_pvp_lobby_settings_v2') {
        return {
          data: {
            map_size: 'medium',
            elevation_bias: 'neutral',
            terrain_bias: 'neutral',
            turn_timer_seconds: null,
          },
          error: null,
        }
      }
      if (name === 'create_pvp_battle_session_v1') {
        mocks.createdBattleArgs = args
        return {
          data: [
            {
              battle_session_id: '00000000-0000-4000-8000-000000003726',
              battle_key: 'P37BATTLE',
            },
          ],
          error: null,
        }
      }
      throw new Error(`Unexpected RPC ${name}`)
    },
  }),
}))

import type { BattleAuthoritativeEncounterState } from './battle-session-service'
import { createBattleSessionService } from './battle-session-service'
import { createBattlePreviewService } from './battle-preview-service'
import { startPvpLobbyWithQuality } from './pvp-lobby-quality-service'

describe('P3.7 direct PvP committed build snapshots', () => {
  beforeEach(() => {
    mocks.createdBattleArgs = null
    mocks.groundSkill = false
  })

  it('persists the same frozen build grammar for both PvP participants', async () => {
    await startPvpLobbyWithQuality(hostUserId, lobbyId)

    const state = mocks.createdBattleArgs?.p_initial_snapshot as
      BattleAuthoritativeEncounterState | undefined
    expect(state).toBeDefined()
    if (!state) throw new Error('Expected PvP initial snapshot.')

    const host = readCombatBuildSnapshot(state, `character:${hostCharacterId}`)
    const guest = readCombatBuildSnapshot(state, `character:${guestCharacterId}`)
    expect(state.buildAuthority).toMatchObject({ catalogVersion: 2, combatContext: 'pvp' })
    for (const combatant of state.buildAuthority!.combatants) {
      const bridge = readCombatBuildSnapshot(state, combatant.combatantId)!
      expect(combatant.primary).toEqual(bridge.primary)
      expect(combatant.secondary).toEqual(bridge.secondary)
      expect(combatant.disciplineSkills).toEqual(bridge.disciplineSkills)
      expect(combatant.extensions).toEqual({
        essence: bridge.extensions.essence,
        resonance: bridge.extensions.resonance,
      })
      expect(combatant.fingerprint).toBe(bridge.fingerprint)
    }
    expect(host?.sourceBuildVersion).toBe(3)
    expect(host?.extensions.essence?.essenceId).toBe('essence.vanguard.unbroken-strike')
    expect(host?.extensions.resonance).toBeNull()
    expect(guest?.sourceBuildVersion).toBe(4)
    expect(guest?.extensions.essence).toBeNull()
    expect(guest?.extensions.resonance?.resonanceId).toBe(
      'resonance.lifebinder-vanguard.mercys-edge',
    )
  })

  it('loads the actual quality-lobby snapshot through facing, ground preview/commit and reload', async () => {
    mocks.groundSkill = true
    await startPvpLobbyWithQuality(hostUserId, lobbyId)
    const initial = structuredClone(
      mocks.createdBattleArgs!.p_initial_snapshot,
    ) as BattleAuthoritativeEncounterState
    const battle = initial.tactical.battle
    let record: BattleSessionRecord = {
      battleSessionId: '00000000-0000-4000-8000-000000003726',
      battleId: battle.battleId,
      battleVersion: 1,
      rulesVersion: battle.rulesVersion,
      contentVersion: battle.contentVersion,
      lifecycle: battle.lifecycle,
      snapshot: initial,
      controlledCombatantIds: [],
      updatedAt: '2026-09-12T00:00:00.000Z',
    }
    const repository: BattleSessionRepository = {
      createBattleSession: async () => {
        throw new Error('Use the actual lobby RPC snapshot.')
      },
      findBattleSession: async (userId) => ({
        ...structuredClone(record),
        controlledCombatantIds: [
          `character:${userId === hostUserId ? hostCharacterId : guestCharacterId}`,
        ],
      }),
      findBattleIntentReplay: async () => null,
      commitBattleIntent: async (input) => {
        expect(input.expectedBattleVersion).toBe(record.battleVersion)
        record = {
          ...record,
          battleVersion: record.battleVersion + 1,
          snapshot: structuredClone(input.nextSnapshot),
        }
        return {
          replayed: false,
          result: {
            battleSessionId: record.battleSessionId,
            battleVersion: record.battleVersion,
            snapshot: record.snapshot,
            committedAt: record.updatedAt,
          },
        }
      },
    }
    const service = createBattleSessionService({
      battles: repository,
      characters: {
        findByOwnerSlot: async () => null,
        createBaseCharacter: async () => {
          throw new Error('Not a character creation test.')
        },
      },
    })
    const hostId = `character:${hostCharacterId}`
    // Always include a real server-facing transition, even if the host initially wins initiative.
    for (let handoff = 0; handoff < 2; handoff += 1) {
      const current = await service.getSession(hostUserId, record.battleSessionId)
      const owner =
        current.snapshot.tactical.battle.currentTurn!.combatantId === hostId
          ? hostUserId
          : guestUserId
      await service.submitIntent({
        userId: owner,
        battleSessionId: record.battleSessionId,
        expectedBattleVersion: record.battleVersion,
        idempotencyKey: `00000000-0000-4000-8000-${String(record.battleVersion).padStart(12, '0')}`,
        intent: { kind: 'face', facing: 'east' },
      })
      if (
        (record.snapshot as BattleAuthoritativeEncounterState).tactical.battle.currentTurn!
          .combatantId === hostId
      )
        break
    }
    const before = await service.getSession(hostUserId, record.battleSessionId)
    const beforePersisted = structuredClone(record.snapshot) as BattleAuthoritativeEncounterState
    expect(before.snapshot.tactical.battle.currentTurn!.combatantId).toBe(hostId)
    expect(before.snapshot.buildAuthority).toEqual(initial.buildAuthority)
    const hostBuild = before.snapshot.buildAuthority!.combatants.find(
      (row) => row.combatantId === hostId,
    )!
    expect(hostBuild.disciplineSkills).toEqual([
      {
        slotIndex: 1,
        skillId: 'frostweaver.chilling-mist',
        contentVersion: 2,
        sourceDisciplineId: 'frostweaver',
      },
    ])
    expect(hostBuild.disciplineSkills).toEqual(
      readCombatBuildSnapshot(beforePersisted, hostId)!.disciplineSkills,
    )
    const previewService = createBattlePreviewService(repository)
    const intent = {
      kind: 'action' as const,
      actionId: 'frostweaver.chilling-mist',
      target: { kind: 'tile' as const, position: { x: 1, y: 1 } },
    }
    const preview = await previewService.previewIntent({
      userId: hostUserId,
      battleSessionId: record.battleSessionId,
      expectedBattleVersion: record.battleVersion,
      intent,
    })
    expect(preview.preview).toMatchObject({
      legal: true,
      affectedCombatantIds: [],
      projectedTerrain: expect.arrayContaining([
        expect.objectContaining({ after: 'frozen', remainingRoundBoundaries: 2 }),
      ]),
    })
    expect(await service.getSession(hostUserId, record.battleSessionId)).toEqual(before)
    const after = await service.submitIntent({
      userId: hostUserId,
      battleSessionId: record.battleSessionId,
      expectedBattleVersion: record.battleVersion,
      idempotencyKey: '00000000-0000-4000-8000-000000000009',
      intent,
    })
    expect(after.battleVersion).toBe(before.battleVersion + 1)
    expect(
      readPv1fActionEconomy(beforePersisted, hostId)!.current -
        readPv1fActionEconomy(record.snapshot as BattleAuthoritativeEncounterState, hostId)!
          .current,
    ).toBe(45)
    expect(after.snapshot.terrainOverlays?.length).toBeGreaterThan(0)
    expect(after.snapshot.buildAuthority).toEqual(initial.buildAuthority)
    expect((await service.getSession(hostUserId, record.battleSessionId)).snapshot).toEqual(
      after.snapshot,
    )

    // The independent timeout/surrender transitions must keep the same frozen extension contract.
    let timedOut = initial
    for (let turn = 0; turn < 3; turn += 1) {
      timedOut = timeoutPvpTurn(timedOut).state as BattleAuthoritativeEncounterState
      expect(timedOut.buildAuthority).toEqual(initial.buildAuthority)
      expect(readCombatBuildSnapshot(timedOut, hostId)).toEqual(
        readCombatBuildSnapshot(initial, hostId),
      )
    }
    for (const combatant of initial.tactical.battle.combatants) {
      const surrendered = surrenderPvpCombatant(initial, combatant.id)
        .state as BattleAuthoritativeEncounterState
      expect(surrendered.buildAuthority).toEqual(initial.buildAuthority)
      expect(readCombatBuildSnapshot(surrendered, hostId)).toEqual(
        readCombatBuildSnapshot(initial, hostId),
      )
    }
    // Historical bridge-only battles remain readable; never reconstruct them from today's Profile.
    const legacy = structuredClone(initial)
    delete legacy.buildAuthority
    record = { ...record, snapshot: legacy }
    const legacyView = await service.getSession(hostUserId, record.battleSessionId)
    expect(legacyView.snapshot).not.toHaveProperty('buildAuthority')
    expect(
      readCombatBuildSnapshot(record.snapshot as BattleAuthoritativeEncounterState, hostId),
    ).toEqual(readCombatBuildSnapshot(initial, hostId))
  })
})
