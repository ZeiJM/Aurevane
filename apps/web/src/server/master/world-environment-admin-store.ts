import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { parseWorldEnvironmentSettings } from '@/server/world/world-environment-store'
import {
  DEFAULT_WORLD_ENVIRONMENT_SETTINGS,
  MAX_TIME_OFFSET_MINUTES,
  isWorldWeather,
  type WorldEnvironmentSettings,
  type WorldWeather,
} from '@/world/environment'

export const WEATHER_DURATIONS = {
  '15m': 15 * 60_000,
  '1h': 3_600_000,
  '6h': 6 * 3_600_000,
  cleared: null,
} as const
export type WeatherDurationKey = keyof typeof WEATHER_DURATIONS

export interface WorldEnvironmentChange {
  timeOffsetMinutes: number
  /** null returns to the live clock. */
  frozenMinuteOfDay: number | null
  /** null returns to live weather. */
  weather: WorldWeather | null
  duration: WeatherDurationKey
}

export interface WorldEnvironmentAuditEntry {
  id: number
  version: number
  actorUserId: string
  reason: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  changedAtMs: number
}

function invalid(message: string): never {
  throw new AurevaneError('INVALID_REQUEST', message)
}

export async function readWorldEnvironmentAdminSettings(): Promise<WorldEnvironmentSettings> {
  const { data, error } = await createSupabaseAdminClient().rpc('read_world_environment_v1')
  if (error?.code === 'PGRST202' || error?.code === '42883')
    return DEFAULT_WORLD_ENVIRONMENT_SETTINGS
  const parsed = error ? null : parseWorldEnvironmentSettings(data)
  if (!parsed)
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'World environment is unavailable.')
  return parsed
}

export async function readWorldEnvironmentHistory(
  limit = 20,
): Promise<WorldEnvironmentAuditEntry[]> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    'read_world_environment_history_v1',
    { p_limit: limit },
  )
  if (error?.code === 'PGRST202' || error?.code === '42883') return []
  if (error || !Array.isArray(data))
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'World environment history is unavailable.')
  return data as WorldEnvironmentAuditEntry[]
}

export async function setWorldEnvironment(input: {
  actorUserId: string
  expectedVersion: unknown
  change: unknown
  reason: unknown
  nowMs?: number
}): Promise<WorldEnvironmentSettings> {
  if (!Number.isSafeInteger(input.expectedVersion) || (input.expectedVersion as number) < 0)
    invalid('expectedVersion must be a non-negative integer.')
  if (
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 8 ||
    input.reason.trim().length > 240
  )
    invalid('A reason from 8 to 240 characters is required.')
  if (!input.change || typeof input.change !== 'object' || Array.isArray(input.change))
    invalid('A change is required.')
  const change = input.change as Partial<WorldEnvironmentChange>
  if (
    !Number.isInteger(change.timeOffsetMinutes) ||
    Math.abs(change.timeOffsetMinutes as number) > MAX_TIME_OFFSET_MINUTES
  )
    invalid('Time offset must be a whole number of minutes between -1440 and 1440.')
  const frozen = change.frozenMinuteOfDay ?? null
  if (frozen !== null && (!Number.isInteger(frozen) || frozen < 0 || frozen > 1439))
    invalid('Frozen time must be a minute of the day from 0 to 1439.')
  const weather = change.weather ?? null
  if (weather !== null && !isWorldWeather(weather)) invalid('Unknown weather condition.')
  const durationKey = change.duration ?? 'cleared'
  if (!Object.prototype.hasOwnProperty.call(WEATHER_DURATIONS, durationKey))
    invalid('Unknown weather duration.')
  const durationMs = WEATHER_DURATIONS[durationKey as WeatherDurationKey]
  const until =
    weather !== null && durationMs !== null ? (input.nowMs ?? Date.now()) + durationMs : null
  const { data, error } = await createSupabaseAdminClient().rpc('set_world_environment_v1', {
    p_actor: input.actorUserId,
    p_expected_version: input.expectedVersion as number,
    p_settings: {
      timeOffsetMinutes: change.timeOffsetMinutes,
      frozenMinuteOfDay: frozen,
      weatherOverride: weather,
      weatherOverrideUntilMs: until,
    },
    p_reason: (input.reason as string).trim(),
  })
  if (error?.message?.includes('WORLD_ENVIRONMENT_VERSION_CONFLICT'))
    throw new AurevaneError('STALE_VERSION', 'Refresh the world environment before changing it.')
  if (error?.message?.includes('INVALID_WORLD_ENVIRONMENT'))
    invalid('The world environment change is invalid.')
  if (error?.code === '42501' || error?.message?.includes('GAME_OWNER_REQUIRED'))
    throw new AurevaneError('FORBIDDEN', 'Only the Game Owner may change the world environment.')
  const parsed = error ? null : parseWorldEnvironmentSettings(data)
  if (!parsed)
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The world environment could not be saved.')
  return parsed
}
