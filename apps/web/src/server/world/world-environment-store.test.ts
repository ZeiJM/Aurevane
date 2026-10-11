import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
import { DEFAULT_WORLD_ENVIRONMENT_SETTINGS } from '@/world/environment'
import {
  parseWorldEnvironmentSettings,
  readWorldEnvironmentSettings,
} from './world-environment-store'

beforeEach(() => rpc.mockReset())

it('reads stored settings', async () => {
  rpc.mockResolvedValueOnce({
    data: {
      version: 4,
      timeOffsetMinutes: -30,
      frozenMinuteOfDay: 600,
      weatherOverride: 'fog',
      weatherOverrideUntilMs: 99,
    },
  })
  expect(await readWorldEnvironmentSettings()).toEqual({
    version: 4,
    timeOffsetMinutes: -30,
    frozenMinuteOfDay: 600,
    weatherOverride: 'fog',
    weatherOverrideUntil: 99,
  })
})
it('fails safe to the live clock and weather on RPC errors, throws or malformed data', async () => {
  rpc.mockResolvedValueOnce({ error: { code: 'PGRST202' } })
  expect(await readWorldEnvironmentSettings()).toEqual(DEFAULT_WORLD_ENVIRONMENT_SETTINGS)
  rpc.mockRejectedValueOnce(new Error('network'))
  expect(await readWorldEnvironmentSettings()).toEqual(DEFAULT_WORLD_ENVIRONMENT_SETTINGS)
  rpc.mockResolvedValueOnce({ data: { version: 1, timeOffsetMinutes: 99999 } })
  expect(await readWorldEnvironmentSettings()).toEqual(DEFAULT_WORLD_ENVIRONMENT_SETTINGS)
})
it('rejects out-of-range or unknown values', () => {
  const ok = { version: 1, timeOffsetMinutes: 0 }
  expect(parseWorldEnvironmentSettings(ok)).not.toBeNull()
  expect(parseWorldEnvironmentSettings({ ...ok, frozenMinuteOfDay: 1440 })).toBeNull()
  expect(parseWorldEnvironmentSettings({ ...ok, weatherOverride: 'hail' })).toBeNull()
})
