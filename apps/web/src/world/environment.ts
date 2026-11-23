/**
 * Server-owned World environment: a shared in-game day/night clock and weather.
 * The default clock follows UTC; configurable cycles remain shared for everyone. Pure and deterministic so every player (and test) resolves the same result.
 */
import { VOID_REALMS, type VoidRealmId } from '@/world/void-realms'
import { weatherAtHour, type WorldWeather } from '@aurevane/game-core/world/weather'

export {
  WORLD_WEATHER,
  isWorldWeather,
  weatherAtHour,
  type WorldWeather,
} from '@aurevane/game-core/world/weather'

export interface WorldEnvironmentSettings {
  /** Real minutes per World day. Absent historical settings retain 24 hours. */
  dayLengthMinutes?: number
  /** Real minutes between automatic weather rolls; absent historical settings retain six hours. */
  weatherRollMinutes?: number
  /** Real minutes between phases for newly arriving uncharted expeditions. */
  warpedShiftMinutes?: number
  /** Shared map override; expires at a real UTC roll boundary. Historical absence means automatic. */
  voidRealmOverride?: VoidRealmId | null
  voidRealmOverrideUntil?: number | null
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
export const DEFAULT_WARPED_SHIFT_MINUTES = 1440
export const MAX_WARPED_SHIFT_MINUTES = 10080
export const MAX_WEATHER_DURATION_MINUTES = 576000
export const DEFAULT_WORLD_ENVIRONMENT_SETTINGS: WorldEnvironmentSettings = {
  dayLengthMinutes: 1440,
  weatherRollMinutes: DEFAULT_WEATHER_ROLL_MINUTES,
  warpedShiftMinutes: DEFAULT_WARPED_SHIFT_MINUTES,
  voidRealmOverride: null,
  voidRealmOverrideUntil: null,
  timeOffsetMinutes: 0,
  frozenMinuteOfDay: null,
  weatherOverride: null,
  weatherOverrideUntil: null,
  version: 0,
}

/** The World clock is real UTC: one real day is one World day. */
export const WORLD_DAY_REAL_MS = 86_400_000
const GAME_MINUTE_MS = WORLD_DAY_REAL_MS / 1440
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

export interface VoidRotation {
  realmId: VoidRealmId
  source: 'live' | 'master'
  /** Epoch milliseconds of the next shared UTC interval boundary. */
  nextRollAt: number
}

/**
 * One seeded draw per UTC interval for the whole World, with repeats allowed.
 * Keep this arithmetic and catalog order in sync with world_void_realm_at_phase_v1.
 * This deliberately does not reinterpret historical warpedPhase expedition ids.
 */
export function resolveVoidRotation(
  nowMs: number,
  settings: WorldEnvironmentSettings = DEFAULT_WORLD_ENVIRONMENT_SETTINGS,
): VoidRotation {
  const intervalMs = (settings.warpedShiftMinutes ?? DEFAULT_WARPED_SHIFT_MINUTES) * 60_000
  const phase = Math.floor(nowMs / intervalMs)
  const nextRollAt = (phase + 1) * intervalMs
  const forced = settings.voidRealmOverride
  if (forced && settings.voidRealmOverrideUntil != null && nowMs < settings.voidRealmOverrideUntil)
    return { realmId: forced, source: 'master', nextRollAt }
  const prime = 2_147_483_647n
  const seed = ((((BigInt(phase) % prime) + prime) % prime) * 48_271n + 131_071n) % prime
  const index = Number(((seed * seed + 104_729n) % prime) % 8n)
  return { realmId: VOID_REALMS[index]!.id, source: 'live', nextRollAt }
}
