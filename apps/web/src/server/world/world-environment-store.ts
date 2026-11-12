import 'server-only'
import { isVoidRealmId } from '@/world/void-realms'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_WORLD_ENVIRONMENT_SETTINGS,
  MAX_TIME_OFFSET_MINUTES,
  MAX_WORLD_DAY_MINUTES,
  MAX_WEATHER_ROLL_MINUTES,
  DEFAULT_WEATHER_ROLL_MINUTES,
  DEFAULT_WARPED_SHIFT_MINUTES,
  MAX_WARPED_SHIFT_MINUTES,
  isWorldWeather,
  type WorldEnvironmentSettings,
} from '@/world/environment'

/** Strictly parses the RPC payload; returns null when malformed. */
export function parseWorldEnvironmentSettings(data: unknown): WorldEnvironmentSettings | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const d = data as Record<string, unknown>
  const int = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
  if (!int(d.version) || (d.version as number) < 0) return null
  if (
    !int(d.timeOffsetMinutes) ||
    Math.abs(d.timeOffsetMinutes as number) > MAX_TIME_OFFSET_MINUTES
  )
    return null
  const dayLengthMinutes = d.dayLengthMinutes === undefined ? 1440 : d.dayLengthMinutes
  if (!int(dayLengthMinutes) || dayLengthMinutes < 1 || dayLengthMinutes > MAX_WORLD_DAY_MINUTES)
    return null
  const weatherRollMinutes =
    d.weatherRollMinutes === undefined ? DEFAULT_WEATHER_ROLL_MINUTES : d.weatherRollMinutes
  if (
    !int(weatherRollMinutes) ||
    weatherRollMinutes < 1 ||
    weatherRollMinutes > MAX_WEATHER_ROLL_MINUTES
  )
    return null
  const warpedShiftMinutes =
    d.warpedShiftMinutes === undefined ? DEFAULT_WARPED_SHIFT_MINUTES : d.warpedShiftMinutes
  if (
    !int(warpedShiftMinutes) ||
    warpedShiftMinutes < 1 ||
    warpedShiftMinutes > MAX_WARPED_SHIFT_MINUTES
  )
    return null
  const frozen = d.frozenMinuteOfDay ?? null
  if (frozen !== null && (!int(frozen) || (frozen as number) < 0 || (frozen as number) > 1439))
    return null
  const weather = d.weatherOverride ?? null
  if (weather !== null && !isWorldWeather(weather)) return null
  const until = d.weatherOverrideUntilMs ?? null
  if (until !== null && !int(until)) return null
  const voidRealmOverride = d.voidRealmOverride ?? null
  const voidRealmOverrideUntil = d.voidRealmOverrideUntilMs ?? null
  if (
    voidRealmOverride !== null &&
    (typeof voidRealmOverride !== 'string' || !isVoidRealmId(voidRealmOverride))
  )
    return null
  if (
    voidRealmOverrideUntil !== null &&
    (!int(voidRealmOverrideUntil) || voidRealmOverrideUntil < 0)
  )
    return null
  if ((voidRealmOverride === null) !== (voidRealmOverrideUntil === null)) return null
  return {
    voidRealmOverride,
    voidRealmOverrideUntil,
    version: d.version as number,
    dayLengthMinutes,
    weatherRollMinutes,
    warpedShiftMinutes,
    timeOffsetMinutes: d.timeOffsetMinutes as number,
    frozenMinuteOfDay: frozen as number | null,
    weatherOverride: weather,
    weatherOverrideUntil: until as number | null,
  }
}

/** Fails safe to the live clock and live weather if the store is missing or errors. */
export async function readWorldEnvironmentSettings(): Promise<WorldEnvironmentSettings> {
  try {
    const { data, error } = await createSupabaseAdminClient().rpc('read_world_environment_v1')
    if (error) return DEFAULT_WORLD_ENVIRONMENT_SETTINGS
    return parseWorldEnvironmentSettings(data) ?? DEFAULT_WORLD_ENVIRONMENT_SETTINGS
  } catch {
    return DEFAULT_WORLD_ENVIRONMENT_SETTINGS
  }
}
