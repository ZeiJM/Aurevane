import 'server-only'
import { createHash } from 'node:crypto'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { loadPublicCharacterProfileImageMap } from '@/server/character/character-profile-display-service'
import { resolvePublicCharacterImageUrl } from '@/media/public-character-portrait'
import { isSafe, newWorldState } from '@/world/travel'
import type { WorldCommand, WorldPlayer, WorldState } from '@/world/types'
import { eventWorldObjectives } from './world-events'
import { WORLD_OBJECTIVES, resolveSector } from './world-content'
import { resolveWorldEnvironment } from '@/world/environment'
import { readWorldEnvironmentSettings } from './world-environment-store'
import { projectWorld, projectWorldPlayers, resolveWorldIntent } from './world-service'

export function worldRpcError(error: { message?: string }): never {
  const message = error.message ?? ''
  if (message.includes('WORLD_NOT_OWNED'))
    throw new AurevaneError('FORBIDDEN', 'That character is unavailable.')
  if (message.includes('WORLD_STALE'))
    throw new AurevaneError(
      'STALE_VERSION',
      'The world changed. Refresh your position and try again.',
    )
  if (message.includes('WORLD_COMMAND_CONFLICT'))
    throw new AurevaneError('IDEMPOTENCY_CONFLICT', 'That travel command was already used.')
  if (message.includes('WORLD_TRAINING'))
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Stop Passive Training before travelling or fighting.',
    )
  if (message.includes('WORLD_ACTIVE_BATTLE'))
    throw new AurevaneError('INVALID_REQUEST', 'Return to your active battle.')
  if (message.includes('WORLD_SPECTATING'))
    throw new AurevaneError('INVALID_REQUEST', 'Leave spectating before travelling.')
  if (message.includes('WORLD_TARGET'))
    throw new AurevaneError('INVALID_REQUEST', 'That player is no longer within reach.')
  if (message.includes('WORLD_STEP_NOT_DUE'))
    throw new AurevaneError('INVALID_REQUEST', 'Your next step is not due yet.')
  throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'World travel is temporarily unavailable.')
}
function storedState(state: WorldState) {
  const sector = resolveSector(state.position.sectorId)
  if (!sector)
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'This location cannot be loaded safely.')
  return { ...state, safe: isSafe(sector, state.position) }
}
async function readWorldData(
  userId: string,
  characterId: string,
  materializeExpired = true,
): Promise<{
  state: unknown
  players: WorldPlayer[]
  serverNow: number
  eventObjectives?: unknown
  trainingExpired?: boolean
  blocked?: string
  battleSessionId?: string
  lastCommandId?: string
  lastCommandFingerprint?: string
}> {
  const { data, error } = await createSupabaseAdminClient().rpc('read_world_state_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_initial_state: storedState(newWorldState()),
  })
  if (error) worldRpcError(error)
  if (
    !data ||
    typeof data !== 'object' ||
    !data.state ||
    !Array.isArray(data.players) ||
    typeof data.serverNow !== 'number'
  )
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'World state could not be loaded.')
  // Materialize through the existing training authority in a separate transaction,
  // before re-reading world state. Never invert its character -> training lock order.
  if (materializeExpired && data.trainingExpired === true) {
    const result = await createSupabaseAdminClient().rpc('materialize_training_report_v2', {
      p_user_id: userId,
      p_character_id: characterId,
    })
    if (result.error) worldRpcError(result.error)
    return readWorldData(userId, characterId, false)
  }
  return data
}
/* Walking sends a request per confirmation, so the two lookups that rarely change are kept
   briefly in memory: portraits for 30 s, Master environment settings for 5 s. */
const PORTRAIT_TTL_MS = 30_000
const ENVIRONMENT_TTL_MS = 5_000
let portraitCache: { key: string; at: number; value: ReadonlyMap<string, string> } | null = null
let environmentCache: {
  at: number
  value: Awaited<ReturnType<typeof readWorldEnvironmentSettings>>
} | null = null
async function cachedProfileImages(ids: readonly string[]) {
  const key = [...ids].sort().join(',')
  const now = Date.now()
  if (portraitCache && portraitCache.key === key && now - portraitCache.at < PORTRAIT_TTL_MS)
    return portraitCache.value
  const value = await loadPublicCharacterProfileImageMap(ids).catch(() => new Map<string, string>())
  portraitCache = { key, at: now, value }
  return value
}
async function cachedEnvironmentSettings() {
  const now = Date.now()
  if (environmentCache && now - environmentCache.at < ENVIRONMENT_TTL_MS)
    return environmentCache.value
  const value = await readWorldEnvironmentSettings()
  environmentCache = { at: now, value }
  return value
}
export function resetWorldReadCaches() {
  portraitCache = null
  environmentCache = null
}
export async function readWorld(userId: string, characterId: string) {
  const data = await readWorldData(userId, characterId)
  const objectives = [...WORLD_OBJECTIVES, ...eventWorldObjectives(data.eventObjectives)]
  const state = data.state as WorldState
  // Build the expensive terrain projection once. Only its server-derived scene IDs
  // can widen presence; unsurveyed cells are filtered before images or serialization.
  const view = projectWorld(state, [], data.serverNow, objectives)
  const sceneSectorIds = view.sectors.map((sector) => sector.id)
  const [presence, environmentSettings] = await Promise.all([
    createSupabaseAdminClient().rpc('read_world_scene_players_v1', {
      p_user_id: userId,
      p_character_id: characterId,
      p_expected_version: state.version,
      p_scene_sector_ids: sceneSectorIds,
      p_initial_position: newWorldState().position,
    }),
    cachedEnvironmentSettings(),
  ])
  if (presence.error) worldRpcError(presence.error)
  const scene = presence.data
  if (
    !scene ||
    !Number.isSafeInteger(scene.version) ||
    !Array.isArray(scene.players) ||
    scene.players.length > 200
  )
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'World presence could not be loaded.')
  // A concurrent command can move the owner between these two reads. Retain the
  // original matching snapshot rather than attaching the newer scene to old terrain.
  const players = projectWorldPlayers(
    state,
    scene.version === state.version ? scene.players : data.players,
    sceneSectorIds,
  )
  const profileImages = await cachedProfileImages(players.map((player) => player.characterId))
  view.players = players.map((player) => ({
    ...player,
    imageUrl: resolvePublicCharacterImageUrl(
      profileImages.get(player.characterId),
      player.portraitRef,
    ),
  }))
  view.environment = resolveWorldEnvironment(data.serverNow, environmentSettings)
  view.characterId = characterId
  view.battleSessionId = typeof data.battleSessionId === 'string' ? data.battleSessionId : null
  view.movementBlocked =
    data.blocked === 'WORLD_TRAINING_ACTIVE'
      ? 'Stop Passive Training to travel.'
      : data.blocked === 'WORLD_SPECTATING'
        ? 'Leave spectating to travel.'
        : data.blocked === 'WORLD_ACTIVE_BATTLE'
          ? 'Return to your active battle.'
          : null
  return {
    state,
    view,
    objectives,
    lastCommandId: data.lastCommandId as string | null,
    lastCommandFingerprint: data.lastCommandFingerprint as string | null,
  }
}
export async function commitWorldCommand(
  userId: string,
  characterId: string,
  command: WorldCommand,
) {
  const current = await readWorld(userId, characterId)
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        characterId,
        expectedVersion: command.expectedVersion,
        intent: command.intent,
      }),
    )
    .digest('hex')
  if (current.lastCommandId === command.commandId) {
    if (current.lastCommandFingerprint !== fingerprint)
      throw new AurevaneError('IDEMPOTENCY_CONFLICT', 'That travel command was already used.')
    return current.view
  }
  if (current.state.version !== command.expectedVersion)
    throw new AurevaneError(
      'STALE_VERSION',
      'Your position changed. Try again from the updated map.',
    )
  if (command.intent.kind === 'attack')
    throw new AurevaneError('INVALID_REQUEST', 'Use the encounter command for attacks.')
  const next = resolveWorldIntent(
    current.state,
    command.intent,
    current.view.serverNow,
    current.objectives,
  )
  const { error } = await createSupabaseAdminClient().rpc('commit_world_state_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_expected_version: command.expectedVersion,
    p_command_id: command.commandId,
    p_kind: command.intent.kind,
    p_next_state: storedState(next),
    p_request_fingerprint: fingerprint,
  })
  if (error) worldRpcError(error)
  return (await readWorld(userId, characterId)).view
}
