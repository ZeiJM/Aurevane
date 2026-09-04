import type { CharacterRecord } from '@aurevane/db/character'
import { readCombatBuildSnapshot } from '@aurevane/game-core/combat/build-snapshot'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
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
          schemaVersion: 2,
          buildVersion: 3,
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
      }
      return {
        schemaVersion: 2,
        buildVersion: 4,
        primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
        secondary: { disciplineId: 'lifebinder', definitionVersion: 1 },
        disciplineSkills: [],
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

import { startPvpLobbyWithQuality } from './pvp-lobby-quality-service'

describe('P3.7 direct PvP committed build snapshots', () => {
  beforeEach(() => {
    mocks.createdBattleArgs = null
  })

  it('persists the same frozen build grammar for both PvP participants', async () => {
    await startPvpLobbyWithQuality(hostUserId, lobbyId)

    const state = mocks.createdBattleArgs?.p_initial_snapshot as
      | StatDrivenCombatEncounterState
      | undefined
    expect(state).toBeDefined()
    if (!state) throw new Error('Expected PvP initial snapshot.')

    const host = readCombatBuildSnapshot(state, `character:${hostCharacterId}`)
    const guest = readCombatBuildSnapshot(state, `character:${guestCharacterId}`)
    expect(host?.sourceBuildVersion).toBe(3)
    expect(host?.extensions.essence?.essenceId).toBe('essence.vanguard.unbroken-strike')
    expect(host?.extensions.resonance).toBeNull()
    expect(guest?.sourceBuildVersion).toBe(4)
    expect(guest?.extensions.essence).toBeNull()
    expect(guest?.extensions.resonance?.resonanceId).toBe(
      'resonance.lifebinder-vanguard.mercys-edge',
    )
  })
})
