import 'server-only'
import { createSelectedCharacterRpc } from './selected-character-rpc'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { parseWorldEnvironmentSettings } from '@/server/world/world-environment-store'
import {
  DEFAULT_WORLD_ENVIRONMENT_SETTINGS,
  MAX_TIME_OFFSET_MINUTES,
  MAX_WORLD_DAY_MINUTES,
  MAX_WEATHER_ROLL_MINUTES,
  MAX_WEATHER_DURATION_MINUTES,
  isWorldWeather,
  type WorldEnvironmentSettings,
  type WorldWeather,
} from '@/world/environment'

export interface WorldEnvironmentChange {
  dayLengthMinutes: number
  weatherRollMinutes?: number
  timeOffsetMinutes: number
  /** null returns to the live clock. */
  frozenMinuteOfDay: number | null
  /** null returns to live weather. */
  weather: WorldWeather | null | 'unchanged'
  durationMinutes: number
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

export async function setWorldEnvironment(input: {
  actorUserId: string
  expectedVersion: unknown
  change: unknown
  nowMs?: number
}): Promise<WorldEnvironmentSettings> {
  if (!Number.isSafeInteger(input.expectedVersion) || (input.expectedVersion as number) < 0)
    invalid('expectedVersion must be a non-negative integer.')
  if (!input.change || typeof input.change !== 'object' || Array.isArray(input.change))
    invalid('A change is required.')
  const change = input.change as Partial<WorldEnvironmentChange>
  if (
    !Number.isInteger(change.timeOffsetMinutes) ||
    Math.abs(change.timeOffsetMinutes as number) > MAX_TIME_OFFSET_MINUTES
  )
    invalid('Time offset must be a whole number of minutes between -1440 and 1440.')
  if (
    !Number.isSafeInteger(change.dayLengthMinutes) ||
    Number(change.dayLengthMinutes) < 1 ||
    Number(change.dayLengthMinutes) > MAX_WORLD_DAY_MINUTES
  )
    invalid(`Day length must be a whole number from 1 to ${MAX_WORLD_DAY_MINUTES} real minutes.`)
  if (
    change.weatherRollMinutes !== undefined &&
    (!Number.isSafeInteger(change.weatherRollMinutes) ||
      Number(change.weatherRollMinutes) < 1 ||
      Number(change.weatherRollMinutes) > MAX_WEATHER_ROLL_MINUTES)
  )
    invalid(
      `Weather roll interval must be a whole number from 1 to ${MAX_WEATHER_ROLL_MINUTES} real minutes.`,
    )
  const frozen = change.frozenMinuteOfDay ?? null
  if (frozen !== null && (!Number.isInteger(frozen) || frozen < 0 || frozen > 1439))
    invalid('Frozen time must be a minute of the day from 0 to 1439.')
  const weather = change.weather ?? null
  if (weather !== null && weather !== 'unchanged' && !isWorldWeather(weather))
    invalid('Unknown weather condition.')
  if (
    weather !== null &&
    weather !== 'unchanged' &&
    (!Number.isSafeInteger(change.durationMinutes) ||
      Number(change.durationMinutes) < 1 ||
      Number(change.durationMinutes) > MAX_WEATHER_DURATION_MINUTES)
  )
    invalid(`Forced weather needs 1 to ${MAX_WEATHER_DURATION_MINUTES} whole minutes.`)
  const until =
    weather !== null && weather !== 'unchanged'
      ? (input.nowMs ?? Date.now()) + change.durationMinutes! * 60_000
      : null
  const { data, error } = await createSelectedCharacterRpc((name, params) =>
    createSupabaseAdminClient().rpc(name, params),
  )('set_world_environment_v2', {
    p_actor: input.actorUserId,
    p_expected_version: input.expectedVersion as number,
    p_settings: {
      dayLengthMinutes: change.dayLengthMinutes,
      ...(change.weatherRollMinutes === undefined
        ? {}
        : { weatherRollMinutes: change.weatherRollMinutes }),
      timeOffsetMinutes: change.timeOffsetMinutes,
      frozenMinuteOfDay: frozen,
      ...(weather === 'unchanged'
        ? {}
        : { weatherOverride: weather, weatherOverrideUntilMs: until }),
    },
  })
  if (error?.message?.includes('WORLD_ENVIRONMENT_VERSION_CONFLICT'))
    throw new AurevaneError('STALE_VERSION', 'Refresh the world environment before changing it.')
  if (error?.message?.includes('INVALID_WORLD_ENVIRONMENT'))
    invalid('The world environment change is invalid.')
  if (error?.code === '42501' || error?.message?.includes('GAME_OWNER_REQUIRED'))
    throw new AurevaneError('FORBIDDEN', 'World Environment page access is required.')
  const parsed = error ? null : parseWorldEnvironmentSettings(data)
  if (!parsed)
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The world environment could not be saved.')
  return parsed
}
