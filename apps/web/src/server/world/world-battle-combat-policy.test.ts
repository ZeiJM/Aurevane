import { expect, it, vi } from 'vitest'
import type { CharacterRecord } from '@aurevane/db/character'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'
import type { BattleAuthoritativeEncounterState } from '@/server/battle/battle-session-service'
vi.mock('server-only', () => ({}))
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('./world-repository', () => ({
  readWorld: async () => ({ view: { players: [{ characterId: 'target', attackable: true }] } }),
  worldRpcError: (error: unknown) => {
    throw error
  },
}))
vi.mock('./world-service', () => ({ assertEncounterRange: () => {} }))
vi.mock('@/server/character/character-build-service', () => ({
  loadCharacterCommittedBuildSnapshot: async () => pureSnapshot(),
}))
vi.mock('@/server/character/supabase-character-build-repository', () => ({
  createSupabaseCharacterBuildRepository: () => ({}),
}))
vi.mock('@/server/character/supabase-character-repository', () => ({
  createSupabaseCharacterRepository: () => ({
    findByOwnerId: async (userId: string, id: string) => characterRecord(id, userId, 'Fighter'),
  }),
}))
vi.mock('@/server/combat/combat-content-resolver', () => ({
  createServerCombatContentResolver: () => ({}),
}))
import { attackWorldPlayer } from './world-battle'
const CREATED_AT = '2026-10-07T00:00:00.000Z'
function characterRecord(id: string, userId: string, name: string): CharacterRecord {
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

it('persists current combat policies and configured heights for a new world encounter', async () => {
  const policy = {
    version: 9,
    level1BasisPoints: 0,
    level2BasisPoints: 0,
    level3BasisPoints: 10000,
  }
  let saved: BattleAuthoritativeEncounterState | undefined
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'read_world_encounter_pair_v1')
      return {
        data: { attacker: {}, target: { version: 1 }, targetUserId: 'opponent' },
        error: null,
      }
    if (name === 'read_battlefield_elevation_policy_v1') return { data: policy, error: null }
    if (name === 'read_combat_effect_timing_policy_v1')
      return { data: { version: 3, modes: { burn: 'instant' } }, error: null }
    if (name === 'start_world_encounter_v1') {
      saved = args.p_snapshot as BattleAuthoritativeEncounterState
      return { data: { battleSessionId: 'world-battle' }, error: null }
    }
    throw new Error('Unexpected RPC ' + name)
  })
  expect((await attackWorldPlayer('owner', 'actor', 'target', 1)).battleSessionId).toBe(
    'world-battle',
  )
  expect(saved!.battlefieldElevationPolicy).toEqual(policy)
  expect(saved!.effectTimingPolicy).toEqual({ version: 3, modes: { burn: 'instant' } })
  expect(saved!.percentageDotPolicyVersion).toBe(1)
  expect(saved!.dotTriggerPolicyVersion).toBe(1)
  expect(saved!.groundEffectPolicyVersion).toBe(1)
  expect(saved!.effectStackingPolicyVersion).toBe(1)
  expect(saved!.tactical.tiles.some((tile) => tile.elevation > 0)).toBe(true)
  expect(
    saved!.tactical.tiles
      .filter((tile) => tile.elevation > 0)
      .every((tile) => tile.elevation === 3),
  ).toBe(true)
})
