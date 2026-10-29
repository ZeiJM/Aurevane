import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { createMasterModerationService } from './moderation-service'
it('checks live page authority before every moderation operation', async () => {
  let allowed = true
  const access = {
    requireCapability: async (_user: string, cap: string) => {
      expect(cap).toBe('moderation.manage')
      if (!allowed) throw Object.assign(new Error('denied'), { code: 'FORBIDDEN' })
    },
  }
  const calls: string[] = []
  const rpc = async (name: string) => {
    calls.push(name)
    return []
  }
  const service = createMasterModerationService(access as never, rpc)
  expect(await service.search('staff', 'Mira')).toEqual([])
  allowed = false
  await expect(service.search('staff', 'Mira')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(service.read('staff', 'target')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(service.listActive('staff')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  expect(calls).toEqual(['search_master_moderation_players_v1'])
})
it('parses bounded unique account ban pages and rejects malformed pagination and inactive rows', async () => {
  const ban = {
    userId: '11111111-1111-4111-8111-111111111111',
    characterId: null,
    name: 'Player',
    active: true,
    permanent: true,
    expiresAt: null,
    protected: false,
    revision: 'a'.repeat(32),
    reason: 'Reviewed conduct',
  }
  const rpc = vi.fn(async () => ({ bans: [ban], nextCursor: null as string | null }))
  const service = createMasterModerationService(
    { requireCapability: async () => ({}) } as never,
    rpc,
  )
  expect(await service.listActive('staff')).toEqual({ bans: [ban], nextCursor: null })
  expect(rpc).toHaveBeenCalledWith('list_active_master_bans_v1', {
    p_actor_user_id: 'staff',
    p_after_user_id: null,
  })
  rpc.mockResolvedValueOnce({ bans: [ban, ban], nextCursor: null })
  await expect(service.listActive('staff')).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
  rpc.mockResolvedValueOnce({ bans: [{ ...ban, active: false }], nextCursor: null })
  await expect(service.listActive('staff')).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
  await expect(service.listActive('staff', 'bad cursor')).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
  })
})
it('rejects invalid durations, empty reasons and untrusted result data', async () => {
  const service = createMasterModerationService(
    { requireCapability: async () => ({}) } as never,
    async () => ({}),
  )
  for (const minutes of [0, -1, 1.5, 52560001])
    await expect(
      service.write('staff', {
        targetUserId: 'target',
        expectedRevision: '0',
        action: 'ban',
        reason: 'Reason',
        minutes,
        permanent: false,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  await expect(
    service.write('staff', {
      targetUserId: 'target',
      expectedRevision: '0',
      action: 'ban',
      reason: ' ',
      minutes: 60,
      permanent: false,
    }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  await expect(service.read('staff', 'target')).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})
it('rejects malformed history cursors and inconsistent active ban states', async () => {
  const valid = {
    userId: 'target',
    revision: 'a'.repeat(32),
    active: false,
    permanent: false,
    expiresAt: null,
    protected: false,
    history: [],
    nextCursor: null,
  }
  const service = (value: unknown) =>
    createMasterModerationService(
      { requireCapability: async () => ({}) } as never,
      async () => value,
    )
  for (const value of [
    { ...valid, nextCursor: '-1' },
    { ...valid, active: true },
    { ...valid, permanent: true },
  ])
    await expect(service(value).read('staff', 'target')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
})
