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

describe('resolveWorldEnvironment', () => {
  it('uses the live clock and weather by default', () => {
    const now = MIDNIGHT + 90 * 60_000
    const env = resolveWorldEnvironment(now, base)
    expect(env).toMatchObject({ minuteOfDay: 90, frozen: false, weatherSource: 'live' })
    expect(env.weather).toBe(weatherAtHour(Math.floor(now / HOUR)))
  })
  it('wraps offsets across midnight in both directions', () => {
    expect(
      resolveWorldEnvironment(MIDNIGHT + 30 * 60_000, { ...base, timeOffsetMinutes: -60 })
        .minuteOfDay,
    ).toBe(1410)
    expect(
      resolveWorldEnvironment(MIDNIGHT + 1430 * 60_000, { ...base, timeOffsetMinutes: 30 })
        .minuteOfDay,
    ).toBe(20)
  })
  it('freezes the clock at a minute of the current UTC day, ignoring the offset', () => {
    const env = resolveWorldEnvironment(MIDNIGHT + 5 * HOUR, {
      ...base,
      frozenMinuteOfDay: 1080,
      timeOffsetMinutes: 300,
    })
    expect(env.frozen).toBe(true)
    expect(env.minuteOfDay).toBe(1080)
    expect(env.effectiveTimeMs).toBe(MIDNIGHT + 1080 * 60_000)
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
    expect(expired.weather).toBe(weatherAtHour(Math.floor((now + 1000) / HOUR)))
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
