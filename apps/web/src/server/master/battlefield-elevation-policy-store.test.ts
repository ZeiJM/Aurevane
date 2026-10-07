import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
const policy = {
  version: 1,
  level1BasisPoints: 6000,
  level2BasisPoints: 3000,
  level3BasisPoints: 1000,
}
beforeEach(() => rpc.mockReset())
it('uses approved defaults only when the migration is absent', async () => {
  const { readBattlefieldElevationPolicy } = await import('./battlefield-elevation-policy-store')
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } })
  expect(await readBattlefieldElevationPolicy()).toEqual(policy)
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'connection-error' } })
  await expect(readBattlefieldElevationPolicy()).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
  rpc.mockResolvedValueOnce({ data: { ...policy, level1BasisPoints: 0 }, error: null })
  await expect(readBattlefieldElevationPolicy()).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})
it('publishes exact validated chances and rejects invalid total or missing reason before persistence', async () => {
  const { publishBattlefieldElevationPolicy } = await import('./battlefield-elevation-policy-store')
  for (const input of [
    { policy: { ...policy, level1BasisPoints: 0 }, reason: 'change' },
    { policy, reason: ' ' },
    { policy: { ...policy, unknown: true }, reason: 'change' },
  ]) {
    await expect(
      publishBattlefieldElevationPolicy({ actorUserId: 'owner', ...input }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  }
  expect(rpc).not.toHaveBeenCalled()
  const next = {
    version: 2,
    level1BasisPoints: 1234,
    level2BasisPoints: 8766,
    level3BasisPoints: 0,
  }
  rpc.mockResolvedValueOnce({ data: next, error: null })
  expect(
    await publishBattlefieldElevationPolicy({
      actorUserId: 'owner',
      policy: { ...next, version: 1 },
      reason: 'exact',
    }),
  ).toEqual(next)
  expect(rpc).toHaveBeenCalledWith('publish_battlefield_elevation_policy_v1', {
    p_actor_user_id: 'owner',
    p_expected_version: 1,
    p_chances: { level1BasisPoints: 1234, level2BasisPoints: 8766, level3BasisPoints: 0 },
    p_reason: 'exact',
  })
})
it.each([
  { error: { message: 'ELEVATION_POLICY_VERSION_CONFLICT' }, code: 'STALE_VERSION' },
  { error: { code: '42501' }, code: 'FORBIDDEN' },
  { error: { code: 'PGRST202' }, code: 'PERSISTENCE_UNAVAILABLE' },
])('fails publication honestly: $code', async ({ error, code }) => {
  const { publishBattlefieldElevationPolicy } = await import('./battlefield-elevation-policy-store')
  rpc.mockResolvedValueOnce({ data: null, error })
  await expect(
    publishBattlefieldElevationPolicy({ actorUserId: 'owner', policy, reason: 'change' }),
  ).rejects.toMatchObject({ code })
})
