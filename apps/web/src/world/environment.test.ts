import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORLD_ENVIRONMENT_SETTINGS as base,
  WORLD_WEATHER,
  resolveWorldEnvironment,
  weatherAtHour,
} from './environment'

const HOUR = 3_600_000
const MIDNIGHT = Date.UTC(2026, 9, 10)

describe('weatherAtHour', () => {
  it('is deterministic and always a known condition', () => {
    for (let h = 480_000; h < 480_200; h++) {
      expect(weatherAtHour(h)).toBe(weatherAtHour(h))
      expect(WORLD_WEATHER).toContain(weatherAtHour(h))
    }
  })
  it('varies over time and mostly persists between adjacent hours', () => {
    const seen = new Set<string>()
    let same = 0
    for (let h = 480_000; h < 480_400; h++) {
      seen.add(weatherAtHour(h))
      if (weatherAtHour(h) === weatherAtHour(h + 1)) same++
    }
    expect(seen.size).toBeGreaterThan(2)
    expect(same).toBeGreaterThan(150)
  })
})

const DAY = 86_400_000
const GAME_MINUTE = 60_000 // the World clock is real UTC
const BLOCK = DAY / 4 // weather moves in six-hour blocks
describe('resolveWorldEnvironment', () => {
  it('runs on real UTC', () => {
    const env = resolveWorldEnvironment(MIDNIGHT + 90 * GAME_MINUTE, base)
    expect(env).toMatchObject({
      minuteOfDay: 90,
      frozen: false,
      weatherSource: 'live',
      dayLengthMs: DAY,
    })
    expect(env.weather).toBe(weatherAtHour(Math.floor((MIDNIGHT + 90 * GAME_MINUTE) / BLOCK)))
    // Noon UTC reads 12:00.
    expect(resolveWorldEnvironment(MIDNIGHT + DAY / 2, base).minuteOfDay).toBe(720)
    expect(resolveWorldEnvironment(MIDNIGHT + DAY / 4, base).minuteOfDay).toBe(360)
  })
  it('wraps offsets across midnight in both directions', () => {
    expect(
      resolveWorldEnvironment(MIDNIGHT + 30 * GAME_MINUTE, { ...base, timeOffsetMinutes: -60 })
        .minuteOfDay,
    ).toBe(1410)
    expect(
      resolveWorldEnvironment(MIDNIGHT + 1430 * GAME_MINUTE, { ...base, timeOffsetMinutes: 30 })
        .minuteOfDay,
    ).toBe(20)
  })
  it('freezes the clock at a minute of the UTC day, ignoring the offset', () => {
    const env = resolveWorldEnvironment(MIDNIGHT + 5 * HOUR + 123, {
      ...base,
      frozenMinuteOfDay: 1080,
      timeOffsetMinutes: 300,
    })
    expect(env.frozen).toBe(true)
    expect(env.minuteOfDay).toBe(1080)
    expect(env.effectiveTimeMs).toBe(MIDNIGHT + 1080 * GAME_MINUTE)
  })
  it('applies a weather override only until it expires', () => {
    const now = MIDNIGHT + 5 * HOUR
    const settings = {
      ...base,
      weatherOverride: 'storm' as const,
      weatherOverrideUntil: now + 1000,
      version: 3,
    }
    expect(resolveWorldEnvironment(now, settings)).toMatchObject({
      weather: 'storm',
      weatherSource: 'master',
      settingsVersion: 3,
    })
    const expired = resolveWorldEnvironment(now + 1000, settings)
    expect(expired.weatherSource).toBe('live')
    expect(expired.weather).toBe(weatherAtHour(Math.floor((now + 1000) / BLOCK)))
  })
  it('keeps an override with no end until cleared', () => {
    const env = resolveWorldEnvironment(MIDNIGHT, {
      ...base,
      weatherOverride: 'fog',
      weatherOverrideUntil: null,
    })
    expect(env).toMatchObject({ weather: 'fog', weatherSource: 'master' })
  })
})

it('advances a configured whole world day through day and night in 120 real minutes', () => {
  const settings = { ...base, dayLengthMinutes: 120 }
  const start = resolveWorldEnvironment(MIDNIGHT, settings)
  const noon = resolveWorldEnvironment(MIDNIGHT + 60 * 60_000, settings)
  const next = resolveWorldEnvironment(MIDNIGHT + 120 * 60_000, settings)
  expect(start.minuteOfDay).toBe(0)
  expect(noon.minuteOfDay).toBe(720)
  expect(next.minuteOfDay).toBe(0)
  expect(noon.dayLengthMs).toBe(120 * 60_000)
  expect(
    resolveWorldEnvironment(MIDNIGHT + 60 * 60_000, { ...settings, timeOffsetMinutes: 60 })
      .minuteOfDay,
  ).toBe(780)
  expect(
    resolveWorldEnvironment(MIDNIGHT + DAY, { ...settings, frozenMinuteOfDay: 360 }).minuteOfDay,
  ).toBe(360)
  expect(noon.weather).toBe(resolveWorldEnvironment(MIDNIGHT + 60 * 60_000, base).weather)
})

it('uses a separate real-minute weather roll interval and preserves historical six-hour cadence', () => {
  for (const now of [1_234_567, MIDNIGHT, MIDNIGHT + 359_999]) {
    expect(resolveWorldEnvironment(now, { ...base, weatherRollMinutes: 5 }).weather).toBe(
      weatherAtHour(Math.floor(now / (5 * 60_000))),
    )
    const historical = { ...base }
    delete historical.weatherRollMinutes
    expect(resolveWorldEnvironment(now, historical).weather).toBe(
      weatherAtHour(Math.floor(now / BLOCK)),
    )
  }
  const settings = {
    ...base,
    weatherRollMinutes: 5,
    weatherOverride: 'storm' as const,
    weatherOverrideUntil: 900_000,
  }
  expect(resolveWorldEnvironment(899_999, settings).weatherSource).toBe('master')
  expect(resolveWorldEnvironment(900_000, settings).weather).toBe(weatherAtHour(3))
})
