import { afterEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc: async () => ({ data: false, error: null }) }),
}))
import { createBattleUsageProvenance } from './usage-balance-provenance'
afterEach(() => vi.unstubAllEnvs())
it('excludes local, preview, CI and explicitly enabled test-mode games', async () => {
  for (const environment of ['preview', 'development', '']) {
    vi.stubEnv('VERCEL_ENV', environment)
    expect(await createBattleUsageProvenance('pvp', ['actor'])).toMatchObject({ eligible: false })
  }
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('AUREVANE_PV2_TEST_MODE', '1')
  expect(await createBattleUsageProvenance('pve-recruit', ['actor'])).toMatchObject({
    eligible: false,
  })
  vi.stubEnv('AUREVANE_PV2_TEST_MODE', '0')
  vi.stubEnv('VITEST', '')
  for (const value of ['true', '1']) {
    vi.stubEnv('CI', value)
    expect(await createBattleUsageProvenance('pvp', ['actor'], async () => false)).toMatchObject({
      eligible: false,
    })
  }
})
it('excludes every participant in tester matches and fails closed when tester admission cannot be read', async () => {
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('AUREVANE_PV2_TEST_MODE', '0')
  vi.stubEnv('CI', '')
  vi.stubEnv('VITEST', '')
  expect(await createBattleUsageProvenance('pvp', ['actor'], async () => true)).toMatchObject({
    eligible: false,
  })
  expect(
    await createBattleUsageProvenance('pvp', ['actor'], async () => {
      throw new Error('offline')
    }),
  ).toMatchObject({ eligible: false })
  expect(await createBattleUsageProvenance('pvp', ['actor'], async () => false)).toEqual({
    version: 1,
    source: 'pvp',
    eligible: true,
  })
})
