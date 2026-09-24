import { beforeEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
vi.mock('server-only', () => ({}))
const { rpc, profileImages } = vi.hoisted(() => ({
  rpc: vi.fn(),
  profileImages: new Map<string, string>(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('@/server/character/character-profile-display-service', () => ({
  loadPublicCharacterProfileImageMap: vi.fn(async () => new Map(profileImages)),
}))
import { newWorldState } from '@/world/travel'
import type { WorldCommand } from '@/world/types'
import { commitWorldCommand, readWorld } from './world-repository'

const characterId = '00000000-0000-4000-8000-000000000011'
const command: WorldCommand = {
  characterId,
  expectedVersion: 1,
  commandId: '00000000-0000-4000-8000-000000000099',
  intent: { kind: 'stop' },
}
const payload = () => ({
  state: newWorldState(),
  players: [],
  serverNow: 5000,
  blocked: null,
  trainingExpired: false,
  lastCommandId: null,
  lastCommandFingerprint: null,
})
beforeEach(() => {
  rpc.mockReset()
  profileImages.clear()
})

it('materializes expired training once using the existing authority, without claiming rewards', async () => {
  rpc
    .mockResolvedValueOnce({
      data: { ...payload(), blocked: 'WORLD_TRAINING_ACTIVE', trainingExpired: true },
    })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: payload() })
  const result = await readWorld('owner', characterId)
  expect(result.view.movementBlocked).toBeNull()
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    'read_world_state_v1',
    'materialize_training_report_v2',
    'read_world_state_v1',
  ])
  expect(rpc.mock.calls[1]?.[1]).toEqual({ p_user_id: 'owner', p_character_id: characterId })
})
it('does not materialize an active plan or loop if a concurrent plan remains blocked', async () => {
  rpc.mockResolvedValue({ data: { ...payload(), blocked: 'WORLD_TRAINING_ACTIVE' } })
  expect((await readWorld('owner', characterId)).view.movementBlocked).toContain('Training')
  expect(rpc).toHaveBeenCalledTimes(1)
})
it('returns authoritative state for a successful retry without another mutation', async () => {
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        characterId,
        expectedVersion: 1,
        intent: command.intent,
      }),
    )
    .digest('hex')
  rpc.mockResolvedValue({
    data: {
      ...payload(),
      state: { ...newWorldState(), version: 2 },
      lastCommandId: command.commandId,
      lastCommandFingerprint: fingerprint,
    },
  })
  const view = await commitWorldCommand('owner', characterId, command)
  expect(view.version).toBe(2)
  expect(view).not.toHaveProperty('lastCommandFingerprint')
  expect(rpc).toHaveBeenCalledTimes(1)
  await expect(
    commitWorldCommand('owner', characterId, {
      ...command,
      intent: { kind: 'cross' },
    }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  await expect(
    commitWorldCommand('owner', characterId, {
      ...command,
      commandId: '00000000-0000-4000-8000-000000000098',
    }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
})

it('records successful early ticks so a retry cannot advance a later due step', async () => {
  rpc
    .mockResolvedValueOnce({ data: payload() })
    .mockResolvedValueOnce({ data: {} })
    .mockResolvedValueOnce({ data: { ...payload(), state: { ...newWorldState(), version: 2 } } })
  expect(
    (await commitWorldCommand('owner', characterId, { ...command, intent: { kind: 'tick' } }))
      .version,
  ).toBe(2)
  expect(rpc.mock.calls[1]?.[0]).toBe('commit_world_state_v1')
  expect(rpc.mock.calls[1]?.[1]).toMatchObject({
    p_kind: 'tick',
    p_request_fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
  })
})

it('projects current profile images for nearby players and starter portraits when unset', async () => {
  const state = newWorldState()
  const customId = '00000000-0000-4000-8000-000000000021'
  const starterId = '00000000-0000-4000-8000-000000000022'
  profileImages.set(customId, 'https://images.example.test/custom-profile.webp')
  rpc.mockResolvedValue({
    data: {
      ...payload(),
      state,
      players: [
        {
          characterId: customId,
          name: 'Custom',
          level: 9,
          portraitRef: 'portrait.starter.wayfarer-01',
          imageUrl: null,
          position: state.position,
          attackable: false,
        },
        {
          characterId: starterId,
          name: 'Starter',
          level: 3,
          portraitRef: 'portrait.starter.wayfarer-07',
          imageUrl: null,
          position: state.position,
          attackable: false,
        },
      ],
    },
  })

  const view = (await readWorld('owner', characterId)).view
  expect(view.players.find((player) => player.characterId === customId)?.imageUrl).toBe(
    'https://images.example.test/custom-profile.webp',
  )
  expect(view.players.find((player) => player.characterId === starterId)?.imageUrl).toMatch(
    /^\/media\/.+\.webp$/,
  )
})
