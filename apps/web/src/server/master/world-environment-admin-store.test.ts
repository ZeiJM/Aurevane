vi.mock('./selected-character-rpc', () => ({ createSelectedCharacterRpc: (rpc: unknown) => rpc }))
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
  weatherOverrideUntilMs: 3_220_000,
}
const base = {
  actorUserId: 'owner',
  expectedVersion: 0,
  nowMs: 1_000_000,
  change: {
    timeOffsetMinutes: 0,
    frozenMinuteOfDay: null,
    weather: 'rain',
    durationMinutes: 37,
    dayLengthMinutes: 120,
  },
}
beforeEach(() => rpc.mockReset())

it('computes the override expiry server-side and sends validated settings', async () => {
  rpc.mockResolvedValueOnce({ data: stored })
  const result = await setWorldEnvironment(base)
  expect(result.weatherOverrideUntil).toBe(3_220_000)
  expect(rpc).toHaveBeenCalledWith('set_world_environment_v2', {
    p_actor: 'owner',
    p_expected_version: 0,
    p_settings: {
      dayLengthMinutes: 120,
      timeOffsetMinutes: 0,
      frozenMinuteOfDay: null,
      weatherOverride: 'rain',
      weatherOverrideUntilMs: 3_220_000,
    },
  })
})
it('rejects invalid whole-minute durations, bad ranges and unknown weather before calling the database', async () => {
  for (const bad of [
    ...[0, -1, 1.5, 576001].map((durationMinutes) => ({
      ...base,
      change: { ...base.change, durationMinutes },
    })),
    ...[0, 10081, 1.5].map((dayLengthMinutes) => ({
      ...base,
      change: { ...base.change, dayLengthMinutes },
    })),
    { ...base, expectedVersion: -1 },
    { ...base, change: { ...base.change, timeOffsetMinutes: 1441 } },
    { ...base, change: { ...base.change, frozenMinuteOfDay: 1440 } },
    { ...base, change: { ...base.change, weather: 'blizzard' } },
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

it('preserves the active weather and its expiry when only clock settings change', async () => {
  rpc.mockResolvedValueOnce({ data: stored })
  await setWorldEnvironment({ ...base, change: { ...base.change, weather: 'unchanged' } })
  expect(rpc.mock.calls[0]![1].p_settings).not.toHaveProperty('weatherOverride')
  expect(rpc.mock.calls[0]![1].p_settings).not.toHaveProperty('weatherOverrideUntilMs')
})

it('persists weather cadence separately from override duration and rejects malformed cadence', async () => {
  rpc.mockResolvedValueOnce({ data: { ...stored, weatherRollMinutes: 5 } })
  expect(
    await setWorldEnvironment({ ...base, change: { ...base.change, weatherRollMinutes: 5 } }),
  ).toMatchObject({ weatherRollMinutes: 5 })
  expect(rpc.mock.calls[0]![1].p_settings).toMatchObject({
    weatherRollMinutes: 5,
    weatherOverrideUntilMs: 3_220_000,
  })
  rpc.mockReset()
  for (const weatherRollMinutes of [0, 1.5, 10081, '5', null])
    await expect(
      setWorldEnvironment({ ...base, change: { ...base.change, weatherRollMinutes } }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  expect(rpc).not.toHaveBeenCalled()
})
