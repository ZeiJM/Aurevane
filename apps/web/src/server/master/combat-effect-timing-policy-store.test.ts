import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
it('pins parsed current policy and maps stale publication while rejecting unknown keys', async () => {
  const service = await import('./combat-effect-timing-policy-store')
  rpc.mockResolvedValueOnce({ data: { version: 3, modes: { hexed: 'instant' } }, error: null })
  expect(await service.readCombatEffectTimingPolicy()).toEqual({
    version: 3,
    modes: { hexed: 'instant' },
  })
  const before = rpc.mock.calls.length
  await expect(
    service.publishCombatEffectTimingPolicy({
      actorUserId: 'owner',
      policy: { version: 3, modes: { invented: 'instant' } },
      reason: 'test',
    }),
  ).rejects.toThrow()
  expect(rpc.mock.calls).toHaveLength(before)
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'TIMING_POLICY_VERSION_CONFLICT' } })
  await expect(
    service.publishCombatEffectTimingPolicy({
      actorUserId: 'owner',
      policy: { version: 3, modes: {} },
      reason: 'change',
    }),
  ).rejects.toThrow('Refresh')
})
