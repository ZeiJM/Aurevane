import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
import { setWorldEnvironment } from './world-environment-admin-store'

const stored = {
  version: 1,
  timeOffsetMinutes: 0,
  frozenMinuteOfDay: null,
  weatherOverride: 'rain',
  weatherOverrideUntilMs: 4_600_000,
}
const base = {
  actorUserId: 'owner',
  expectedVersion: 0,
  reason: 'Testing the rainy dusk',
  nowMs: 1_000_000,
  change: { timeOffsetMinutes: 0, frozenMinuteOfDay: null, weather: 'rain', duration: '1h' },
}
beforeEach(() => rpc.mockReset())

it('computes the override expiry server-side and sends validated settings', async () => {
  rpc.mockResolvedValueOnce({ data: stored })
  const result = await setWorldEnvironment(base)
  expect(result.weatherOverrideUntil).toBe(4_600_000)
  expect(rpc).toHaveBeenCalledWith('set_world_environment_v1', {
    p_actor: 'owner',
    p_expected_version: 0,
    p_settings: {
      timeOffsetMinutes: 0,
      frozenMinuteOfDay: null,
      weatherOverride: 'rain',
      weatherOverrideUntilMs: 4_600_000,
    },
    p_reason: 'Testing the rainy dusk',
  })
})
it('rejects short reasons, bad ranges and unknown weather before calling the database', async () => {
  for (const bad of [
    { ...base, reason: 'short' },
    { ...base, expectedVersion: -1 },
    { ...base, change: { ...base.change, timeOffsetMinutes: 1441 } },
    { ...base, change: { ...base.change, frozenMinuteOfDay: 1440 } },
    { ...base, change: { ...base.change, weather: 'blizzard' } },
    { ...base, change: { ...base.change, duration: '2h' } },
  ])
    await expect(setWorldEnvironment(bad)).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  expect(rpc).not.toHaveBeenCalled()
})
it('maps stale versions and owner-only failures', async () => {
  rpc.mockResolvedValueOnce({ error: { message: 'WORLD_ENVIRONMENT_VERSION_CONFLICT' } })
  await expect(setWorldEnvironment(base)).rejects.toMatchObject({ code: 'STALE_VERSION' })
  rpc.mockResolvedValueOnce({ error: { message: 'GAME_OWNER_REQUIRED' } })
  await expect(setWorldEnvironment(base)).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
it('clears the override expiry when returning to live weather', async () => {
  rpc.mockResolvedValueOnce({
    data: { ...stored, weatherOverride: null, weatherOverrideUntilMs: null },
  })
  await setWorldEnvironment({ ...base, change: { ...base.change, weather: null } })
  expect(rpc.mock.calls[0]?.[1].p_settings.weatherOverrideUntilMs).toBeNull()
})
