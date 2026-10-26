/**
 * Server-owned World environment: a shared in-game day/night clock and weather.
 * The default clock follows UTC; configurable cycles remain shared for everyone. Pure and deterministic so every player (and test) resolves the same result.
 */
export const WORLD_WEATHER = ['clear', 'overcast', 'rain', 'storm', 'fog', 'wind'] as const
export type WorldWeather = (typeof WORLD_WEATHER)[number]

export interface WorldEnvironmentSettings {
  /** Real minutes per World day. Absent historical settings retain 24 hours. */
  dayLengthMinutes?: number
  /** Real minutes between automatic weather rolls; absent historical settings retain six hours. */
  weatherRollMinutes?: number
  /** Added to the in-game clock, in in-game minutes (-1440..1440). */
  timeOffsetMinutes: number
  /** When set, the clock is frozen at this minute of the in-game day (0..1439). */
  frozenMinuteOfDay: number | null
  weatherOverride: WorldWeather | null
  /** Epoch ms after which the override is ignored; null means until cleared. */
  weatherOverrideUntil: number | null
  version: number
}

export interface WorldEnvironment {
  /** Epoch ms on the shared, cycle-scaled in-game clock, including the Master offset. */
  effectiveTimeMs: number
  /** In-game minute of the day, 0..1439.99. */
  minuteOfDay: number
  /** Real milliseconds in one in-game day; the clock advances 1440 minutes over this span. */
  dayLengthMs: number
  frozen: boolean
  weather: WorldWeather
  weatherSource: 'live' | 'master'
  settingsVersion: number
}

export const MAX_TIME_OFFSET_MINUTES = 1440
export const MAX_WORLD_DAY_MINUTES = 10080
export const MAX_WEATHER_ROLL_MINUTES = 10080
export const DEFAULT_WEATHER_ROLL_MINUTES = 360
export const MAX_WEATHER_DURATION_MINUTES = 576000
export const DEFAULT_WORLD_ENVIRONMENT_SETTINGS: WorldEnvironmentSettings = {
  dayLengthMinutes: 1440,
  weatherRollMinutes: DEFAULT_WEATHER_ROLL_MINUTES,
  timeOffsetMinutes: 0,
  frozenMinuteOfDay: null,
  weatherOverride: null,
  weatherOverrideUntil: null,
  version: 0,
}

/** The World clock is real UTC: one real day is one World day. */
export const WORLD_DAY_REAL_MS = 86_400_000
const GAME_MINUTE_MS = WORLD_DAY_REAL_MS / 1440
const STAY = 0.5
const LOOKBACK_HOURS = 96 // look-back, in six-hour weather blocks
const TRANSITIONS: Record<WorldWeather, Partial<Record<WorldWeather, number>>> = {
  clear: { overcast: 0.4, wind: 0.25, fog: 0.2, rain: 0.15 },
  overcast: { clear: 0.35, rain: 0.35, fog: 0.1, wind: 0.1, storm: 0.1 },
  rain: { overcast: 0.4, storm: 0.25, clear: 0.2, fog: 0.15 },
  storm: { rain: 0.5, overcast: 0.4, clear: 0.1 },
  fog: { clear: 0.5, overcast: 0.35, rain: 0.15 },
  wind: { clear: 0.4, overcast: 0.35, rain: 0.15, storm: 0.1 },
}

function hash(n: number): number {
  let t = (n + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const weatherCache = new Map<number, WorldWeather>()

export function weatherAtHour(hourIndex: number): WorldWeather {
  const h = Math.floor(hourIndex)
  const cached = weatherCache.get(h)
  if (cached) return cached
  let w: WorldWeather = 'clear'
  for (let i = h - LOOKBACK_HOURS; i <= h; i++) {
    if (hash(i) < STAY) continue
    let acc = 0
    const r = hash(i + 7919)
    for (const [k, p] of Object.entries(TRANSITIONS[w]) as [WorldWeather, number][]) {
      acc += p
      if (r < acc) {
        w = k
        break
      }
    }
  }
  if (weatherCache.size > 4096) weatherCache.clear()
  weatherCache.set(h, w)
  return w
}

export function isWorldWeather(value: unknown): value is WorldWeather {
  return typeof value === 'string' && (WORLD_WEATHER as readonly string[]).includes(value)
}

export function resolveWorldEnvironment(
  nowMs: number,
  settings: WorldEnvironmentSettings = DEFAULT_WORLD_ENVIRONMENT_SETTINGS,
): WorldEnvironment {
  const frozen = settings.frozenMinuteOfDay !== null
  const dayLengthMs = (settings.dayLengthMinutes ?? 1440) * 60_000
  const effectiveTimeMs = frozen
    ? Math.floor(nowMs / WORLD_DAY_REAL_MS) * WORLD_DAY_REAL_MS +
      settings.frozenMinuteOfDay! * GAME_MINUTE_MS
    : (nowMs / dayLengthMs) * WORLD_DAY_REAL_MS + settings.timeOffsetMinutes * GAME_MINUTE_MS
  const minuteOfDay =
    (((effectiveTimeMs % WORLD_DAY_REAL_MS) + WORLD_DAY_REAL_MS) % WORLD_DAY_REAL_MS) /
    GAME_MINUTE_MS
  const overrideActive =
    settings.weatherOverride !== null &&
    (settings.weatherOverrideUntil === null || nowMs < settings.weatherOverrideUntil)
  return {
    effectiveTimeMs,
    minuteOfDay,
    dayLengthMs,
    frozen,
    weather: overrideActive
      ? settings.weatherOverride!
      : weatherAtHour(
          Math.floor(
            nowMs / ((settings.weatherRollMinutes ?? DEFAULT_WEATHER_ROLL_MINUTES) * 60_000),
          ),
        ),
    weatherSource: overrideActive ? 'master' : 'live',
    settingsVersion: settings.version,
  }
}

export function worldTimeLabel(minute: number): string {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
export function worldDayPhase(minute: number): 'Night' | 'Dawn' | 'Day' | 'Dusk' {
  if (minute >= 360 && minute < 480) return 'Dawn'
  if (minute >= 480 && minute < 1080) return 'Day'
  if (minute >= 1080 && minute < 1200) return 'Dusk'
  return 'Night'
}
