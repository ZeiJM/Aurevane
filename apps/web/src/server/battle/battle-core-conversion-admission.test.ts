import { beforeEach, expect, it, vi } from 'vitest'
import type { CreateBattleSessionInput } from '@aurevane/db/battle-session'

vi.mock('server-only', () => ({}))
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))

import { createSupabaseBattleSessionRepository } from './supabase-battle-session-repository'
import { joinPvpLobby } from './pvp-lobby-service'
import { getPvpLobbyMapSettings } from './pvp-lobby-quality-service'

const userId = '11111111-1111-4111-8111-111111111111'
const characterId = '22222222-2222-4222-8222-222222222222'
const input: CreateBattleSessionInput = {
  actorKey: userId,
  userId,
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
  requestFingerprint: 'conversion-admission',
  battleId: 'battle:conversion',
  rulesVersion: 1,
  contentVersion: 1,
  initialSnapshot: {},
  participants: [{ combatantId: 'actor', participantRole: 'player', characterId }],
}
const boundaries = [
  ['battle persistence', () => createSupabaseBattleSessionRepository().createBattleSession(input)],
  ['PvP lobby', () => joinPvpLobby({ userId, characterId, lobbyKey: 'fixture-key' })],
  ['configured PvP staging', () => getPvpLobbyMapSettings(userId, 'fixture-lobby')],
] as const

beforeEach(() => rpc.mockReset())
it.each(boundaries)(
  'gives actionable conversion guidance through %s without retrying the rejected RPC',
  async (_name, call) => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'CHARACTER_CORE_CONVERSION_REQUIRED' },
    })
    await expect(call()).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      message: 'Complete the required Core Stat conversion before starting a new battle.',
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  },
)
it.each(boundaries)('keeps permission failures forbidden through %s', async (_name, call) => {
  rpc.mockResolvedValue({
    data: null,
    error: { code: '42501', message: 'CHARACTER_CORE_CONVERSION_REQUIRED' },
  })
  await expect(call()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  expect(rpc).toHaveBeenCalledTimes(1)
})
it.each(boundaries)('retains unrelated SQL failure handling through %s', async (_name, call) => {
  rpc.mockResolvedValue({
    data: null,
    error: { code: '22023', message: 'UNRELATED_DATABASE_FAILURE' },
  })
  await expect(call()).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  expect(rpc).toHaveBeenCalledTimes(1)
})
