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

const GAME_MINUTE = 2500 // one real hour is one in-game day
const BLOCK = HOUR / 4 // weather moves in six-hour in-game blocks
describe('resolveWorldEnvironment', () => {
  it('runs on the in-game clock: one real hour is one in-game day', () => {
    const env = resolveWorldEnvironment(MIDNIGHT + 90 * GAME_MINUTE, base)
    expect(env).toMatchObject({
      minuteOfDay: 90,
      frozen: false,
      weatherSource: 'live',
      dayLengthMs: HOUR,
    })
    expect(env.weather).toBe(weatherAtHour(Math.floor((MIDNIGHT + 90 * GAME_MINUTE) / BLOCK)))
    // A real half hour is half an in-game day, wherever the real UTC day happens to be.
    expect(resolveWorldEnvironment(MIDNIGHT + HOUR / 2, base).minuteOfDay).toBe(720)
    expect(resolveWorldEnvironment(MIDNIGHT + 7 * HOUR + HOUR / 4, base).minuteOfDay).toBe(360)
  })
  it('wraps offsets across in-game midnight in both directions', () => {
    expect(
      resolveWorldEnvironment(MIDNIGHT + 30 * GAME_MINUTE, { ...base, timeOffsetMinutes: -60 })
        .minuteOfDay,
    ).toBe(1410)
    expect(
      resolveWorldEnvironment(MIDNIGHT + 1430 * GAME_MINUTE, { ...base, timeOffsetMinutes: 30 })
        .minuteOfDay,
    ).toBe(20)
  })
  it('freezes the clock at a minute of the in-game day, ignoring the offset', () => {
    const env = resolveWorldEnvironment(MIDNIGHT + 5 * HOUR + 123, {
      ...base,
      frozenMinuteOfDay: 1080,
      timeOffsetMinutes: 300,
    })
    expect(env.frozen).toBe(true)
    expect(env.minuteOfDay).toBe(1080)
    expect(env.effectiveTimeMs).toBe(MIDNIGHT + 5 * HOUR + 1080 * GAME_MINUTE)
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
