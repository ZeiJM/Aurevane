import { beforeEach, expect, it, vi } from 'vitest'
import type { WorldCommand } from '@/world/types'

const { rpc, createSession, battleService } = vi.hoisted(() => {
  const createSession = vi.fn()
  return { rpc: vi.fn(), createSession, battleService: vi.fn(() => ({ createSession })) }
})
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('@/server/battle/battle-session-service', () => ({
  createBattleSessionService: battleService,
}))
vi.mock('@/server/character/supabase-character-build-repository', () => ({
  createSupabaseCharacterBuildRepository: vi.fn(),
}))
vi.mock('@/server/character/supabase-character-repository', () => ({
  createSupabaseCharacterRepository: vi.fn(),
}))
vi.mock('@/server/combat/combat-content-resolver', () => ({
  createServerCombatContentResolver: vi.fn(),
}))

import { startWorldAvengerBattle, startWorldNpcBattle } from './world-npc-battle'

const userId = '11111111-1111-4111-8111-111111111111'
const characterId = '22222222-2222-4222-8222-222222222222'
const battleId = '33333333-3333-4333-8333-333333333333'
const npcId = '44444444-4444-4444-8444-444444444444'
const ticketId = '55555555-5555-4555-8555-555555555555'
const command: WorldCommand = {
  characterId,
  commandId: '66666666-6666-4666-8666-666666666666',
  expectedVersion: 12,
  intent: { kind: 'interact', interactionId: `avenger-${ticketId}` },
}
const fingerprint = 'world-fingerprint'
const arenaNpc = {
  id: npcId,
  name: 'Ashen Sentinel',
  portraitRef: null,
  revision: 7,
  arenaId: 'duel-yard',
  aiDifficulty: 'high',
  lore: '',
}
const placement = { sectorId: 'verdant-expanse', x: 2, y: 4 }

beforeEach(() => {
  rpc.mockReset()
  battleService.mockClear()
  createSession.mockReset().mockResolvedValue({ battleSessionId: battleId })
})

it('resolves the ticket opponent in the owned World reader and uses the canonical NPC battle service', async () => {
  rpc
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: { ...arenaNpc, placement }, error: null })

  await expect(
    startWorldAvengerBattle(userId, characterId, ticketId, command, fingerprint),
  ).resolves.toBe(battleId)

  expect(rpc.mock.calls).toEqual([
    [
      'read_world_avenger_battle_replay_v1',
      {
        p_user_id: userId,
        p_character_id: characterId,
        p_ticket_id: ticketId,
        p_command_id: command.commandId,
        p_world_fingerprint: fingerprint,
      },
    ],
    [
      'read_world_avenger_battle_v1',
      {
        p_user_id: userId,
        p_character_id: characterId,
        p_ticket_id: ticketId,
        p_expected_version: command.expectedVersion,
      },
    ],
  ])
  expect(createSession).toHaveBeenCalledExactlyOnceWith({
    userId,
    characterId,
    arenaNpcId: npcId,
    worldNpcEncounter: true,
    idempotencyKey: command.commandId,
  })
})

it('replays an exact ticket receipt without preparing or starting another battle', async () => {
  rpc.mockResolvedValueOnce({ data: battleId, error: null })

  await expect(
    startWorldAvengerBattle(userId, characterId, ticketId, command, fingerprint),
  ).resolves.toBe(battleId)
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(createSession).not.toHaveBeenCalled()
})

it('recovers the exact ticket receipt when a concurrent admission makes preparation stale', async () => {
  rpc
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: null, error: { code: 'PT409', message: 'WORLD_STALE_VERSION' } })
    .mockResolvedValueOnce({ data: battleId, error: null })

  await expect(
    startWorldAvengerBattle(userId, characterId, ticketId, command, fingerprint),
  ).resolves.toBe(battleId)
  expect(rpc.mock.calls[2]).toEqual(rpc.mock.calls[0])
  expect(createSession).not.toHaveBeenCalled()
})

it('rejects a ticket opponent whose placement is no longer valid', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({
    data: { ...arenaNpc, placement: { ...placement, x: 99 } },
    error: null,
  })

  await expect(
    startWorldAvengerBattle(userId, characterId, ticketId, command, fingerprint),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  expect(createSession).not.toHaveBeenCalled()
})

it('keeps an ordinary World encounter on the NPC admission path', async () => {
  rpc
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: { ...arenaNpc, placement }, error: null })

  await expect(startWorldNpcBattle(userId, characterId, npcId, command, fingerprint)).resolves.toBe(
    battleId,
  )
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    'read_world_npc_battle_replay_v1',
    'read_world_npc_battle_v1',
  ])
  expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p_npc_id: npcId })
})
