import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_WORLD_ENVIRONMENT_SETTINGS,
  MAX_TIME_OFFSET_MINUTES,
  isWorldWeather,
  type WorldEnvironmentSettings,
} from '@/world/environment'

/** Strictly parses the RPC payload; returns null when malformed. */
export function parseWorldEnvironmentSettings(data: unknown): WorldEnvironmentSettings | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const d = data as Record<string, unknown>
  const int = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v)
  if (!int(d.version) || (d.version as number) < 0) return null
  if (
    !int(d.timeOffsetMinutes) ||
    Math.abs(d.timeOffsetMinutes as number) > MAX_TIME_OFFSET_MINUTES
  )
    return null
  const frozen = d.frozenMinuteOfDay ?? null
  if (frozen !== null && (!int(frozen) || (frozen as number) < 0 || (frozen as number) > 1439))
    return null
  const weather = d.weatherOverride ?? null
  if (weather !== null && !isWorldWeather(weather)) return null
  const until = d.weatherOverrideUntilMs ?? null
  if (until !== null && !int(until)) return null
  return {
    version: d.version as number,
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
