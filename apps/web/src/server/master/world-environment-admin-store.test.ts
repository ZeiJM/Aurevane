vi.mock('./selected-character-rpc', () => ({ createSelectedCharacterRpc: (rpc: unknown) => rpc }))
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
import { resolveWorldEnvironment } from '@/world/environment'
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
afterEach(() => vi.useRealTimers())

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

const scheduledChange = {
  dayLengthMinutes: 120,
  weatherRollMinutes: 1,
  timeOffsetMinutes: 0,
  frozenMinuteOfDay: null,
  weather: 'rain',
}

it.each([
  [1_000_000, 1_020_000],
  [1_020_000, 1_080_000],
])('ends manual weather at the next automatic roll from %i', async (nowMs, expiry) => {
  rpc.mockImplementation(async (name, params) => ({
    data: {
      ...stored,
      ...params?.p_settings,
      version: 1,
    },
  }))
  const result = await setWorldEnvironment({ ...base, nowMs, change: scheduledChange })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(result.weatherOverrideUntil).toBe(expiry)
  expect(resolveWorldEnvironment(expiry - 1, result).weatherSource).toBe('master')
  expect(resolveWorldEnvironment(expiry, result).weatherSource).toBe('live')
  expect(resolveWorldEnvironment(expiry + 60_000, result).weatherSource).toBe('live')
})

it.each([
  [3_220_000, 1_020_000],
  [1_010_000, 1_010_000],
  [null, 1_020_000],
])(
  'caps an existing override at the next roll without extending its earlier expiry (%s)',
  async (previousExpiry, expectedExpiry) => {
    rpc
      .mockResolvedValueOnce({
        data: { ...stored, version: 0, weatherOverrideUntilMs: previousExpiry },
      })
      .mockResolvedValueOnce({ data: stored })
    await setWorldEnvironment({ ...base, change: { ...scheduledChange, weather: 'unchanged' } })
    expect(rpc.mock.calls[1]?.[1].p_settings).toMatchObject({
      weatherOverride: 'rain',
      weatherOverrideUntilMs: expectedExpiry,
    })
  },
)

it.each([null, 'rain'])(
  'does not restart expired or absent weather (%s)',
  async (weatherOverride) => {
    rpc
      .mockResolvedValueOnce({
        data: { ...stored, version: 0, weatherOverride, weatherOverrideUntilMs: 999_999 },
      })
      .mockResolvedValueOnce({ data: stored })
    await setWorldEnvironment({ ...base, change: { ...scheduledChange, weather: 'unchanged' } })
    expect(rpc.mock.calls[1]?.[1].p_settings).not.toHaveProperty('weatherOverride')
  },
)

it('rejects a stale settings read before modifying the retained weather', async () => {
  rpc.mockResolvedValueOnce({ data: stored })
  await expect(
    setWorldEnvironment({ ...base, change: { ...scheduledChange, weather: 'unchanged' } }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  expect(rpc).toHaveBeenCalledTimes(1)
})

it('does not write if the current weather cannot be read', async () => {
  rpc.mockResolvedValueOnce({ error: { message: 'unavailable' } })
  await expect(
    setWorldEnvironment({ ...base, change: { ...scheduledChange, weather: 'unchanged' } }),
  ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  expect(rpc).toHaveBeenCalledTimes(1)
})

it('settles a save crossing the roll boundary into automatic weather without extending it', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(1_019_999)
  rpc
    .mockImplementationOnce(async () => {
      vi.setSystemTime(1_020_000)
      return { error: { message: 'INVALID_WORLD_ENVIRONMENT' } }
    })
    .mockResolvedValueOnce({
      data: { ...stored, weatherOverride: null, weatherOverrideUntilMs: null },
    })
  const result = await setWorldEnvironment({ ...base, nowMs: undefined, change: scheduledChange })
  expect(rpc).toHaveBeenCalledTimes(2)
  expect(rpc.mock.calls[1]?.[1]).toMatchObject({
    p_expected_version: 0,
    p_settings: {
      weatherRollMinutes: 1,
      weatherOverride: null,
      weatherOverrideUntilMs: null,
    },
  })
  expect(result.weatherOverride).toBeNull()
})

it('preserves stale-write rejection if another save wins during boundary recovery', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(1_019_999)
  rpc
    .mockImplementationOnce(async () => {
      vi.setSystemTime(1_020_000)
      return { error: { message: 'INVALID_WORLD_ENVIRONMENT' } }
    })
    .mockResolvedValueOnce({ error: { message: 'WORLD_ENVIRONMENT_VERSION_CONFLICT' } })
  await expect(
    setWorldEnvironment({ ...base, nowMs: undefined, change: scheduledChange }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  expect(rpc).toHaveBeenCalledTimes(2)
})

it('does not retry an invalid save before the selected expiry', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(1_000_000)
  rpc.mockResolvedValueOnce({ error: { message: 'INVALID_WORLD_ENVIRONMENT' } })
  await expect(setWorldEnvironment({ ...base, change: scheduledChange })).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
  })
  expect(rpc).toHaveBeenCalledTimes(1)
})

it('clears a retained earlier expiry that elapses during the save without restarting weather', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(1_009_999)
  rpc
    .mockResolvedValueOnce({ data: { ...stored, version: 0, weatherOverrideUntilMs: 1_010_000 } })
    .mockImplementationOnce(async () => {
      vi.setSystemTime(1_010_000)
      return { error: { message: 'INVALID_WORLD_ENVIRONMENT' } }
    })
    .mockResolvedValueOnce({
      data: { ...stored, weatherOverride: null, weatherOverrideUntilMs: null },
    })
  await setWorldEnvironment({
    ...base,
    nowMs: undefined,
    change: { ...scheduledChange, weather: 'unchanged' },
  })
  expect(rpc).toHaveBeenCalledTimes(3)
  expect(rpc.mock.calls[2]?.[1]).toMatchObject({
    p_expected_version: 0,
    p_settings: {
      weatherOverride: null,
      weatherOverrideUntilMs: null,
    },
  })
})
