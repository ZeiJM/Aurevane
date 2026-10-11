import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
it('loads the published policy after obsolete Copy and Summoned timing settings retire', async () => {
  const service = await import('./combat-effect-timing-policy-store')
  const stored = { version: 3, modes: { copy: 'instant', summoned: 'instant', summon: 'instant' } }
  rpc.mockResolvedValueOnce({ data: stored, error: null })
  expect(await service.readCombatEffectTimingPolicy()).toEqual({
    version: 3,
    modes: { summon: 'instant' },
  })
  expect(stored.modes).toEqual({ copy: 'instant', summoned: 'instant', summon: 'instant' })
  await expect(
    service.publishCombatEffectTimingPolicy({
      actorUserId: 'owner',
      policy: stored,
      reason: 'test',
    }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
})

it.each([
  { version: 3, modes: { copy: 'invented' } },
  { version: 3, modes: { invented: 'instant' } },
  JSON.parse('{"version":3,"modes":{"__proto__":"instant"}}'),
  { version: 3, modes: { summoned: 'instant' }, invented: true },
])('still rejects malformed or unknown stored timing settings: %j', async (stored) => {
  const service = await import('./combat-effect-timing-policy-store')
  rpc.mockResolvedValueOnce({ data: stored, error: null })
  await expect(service.readCombatEffectTimingPolicy()).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})

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
