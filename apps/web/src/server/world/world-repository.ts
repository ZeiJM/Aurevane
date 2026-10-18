import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { loadPublicCharacterProfileImageMap } from '@/server/character/character-profile-display-service'
import { resolvePublicCharacterImageUrl } from '@/media/public-character-portrait'
import { isSafe, newWorldState, validCell, MAX_PERSISTED_ROUTE_STEPS } from '@/world/travel'
import { STEP_MS } from '@/world/catalog'
import type { WorldMovementReceipt } from '@/world/movement-receipt'
import type {
  WorldCommand,
  WorldPlayer,
  WorldSceneViewport,
  WorldState,
  WorldView,
} from '@/world/types'
import { eventWorldObjectives } from './world-events'
import { WORLD_OBJECTIVES, resolveSector } from './world-content'
import { resolveWorldEnvironment } from '@/world/environment'
import { readWorldEnvironmentSettings } from './world-environment-store'
import {
  projectWorld,
  projectWorldPlayers,
  projectWorldSector,
  resolveWorldIntent,
} from './world-service'

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
export async function resolveWorldPlayerImages(players: readonly WorldPlayer[]) {
  const profileImages = await cachedProfileImages(players.map((player) => player.characterId))
  return players.map((player) => ({
    ...player,
    imageUrl: resolvePublicCharacterImageUrl(
      profileImages.get(player.characterId),
      player.portraitRef,
    ),
  }))
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
export async function readWorld(
  userId: string,
  characterId: string,
  viewport?: WorldSceneViewport,
) {
  return presentWorldData(userId, characterId, await readWorldData(userId, characterId), viewport)
}
/** Encounter preparation needs local visibility and attack authority, not scene presentation. */
function projectWorldAttackAuthority(data: Awaited<ReturnType<typeof readWorldData>>) {
  if (data.blocked) worldRpcError({ message: data.blocked })
  const state = data.state as WorldState
  return {
    state,
    serverNow: data.serverNow,
    players: projectWorldPlayers(state, data.players, [state.position.sectorId]),
  }
}
export async function readWorldAttackAuthority(userId: string, characterId: string) {
  return projectWorldAttackAuthority(await readWorldData(userId, characterId))
}
/** A confirmed route can reach attack range between heartbeats. Persist due owned steps first. */
export async function settleWorldAttackAuthority(
  userId: string,
  characterId: string,
  expectedVersion: number,
) {
  const current = await readWorldData(userId, characterId)
  const authority = projectWorldAttackAuthority(current)
  const { state } = authority
  if (state.version !== expectedVersion)
    throw new AurevaneError(
      'STALE_VERSION',
      'Your position changed. Try again from the updated map.',
    )
  if (!state.route.length || state.nextStepAt === null || state.nextStepAt > current.serverNow)
    return authority
  const intent = { kind: 'tick' } as const
  const next = resolveWorldIntent(state, intent, current.serverNow, [
    ...WORLD_OBJECTIVES,
    ...eventWorldObjectives(current.eventObjectives),
  ])
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ characterId, expectedVersion, intent }))
    .digest('hex')
  const { data, error } = await createSupabaseAdminClient().rpc('commit_world_state_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_expected_version: expectedVersion,
    p_command_id: randomUUID(),
    p_kind: intent.kind,
    p_next_state: storedState(next),
    p_request_fingerprint: fingerprint,
  })
  if (error) worldRpcError(error)
  if (!data || !Number.isSafeInteger(data.version) || data.version !== expectedVersion + 1)
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Your confirmed position could not be loaded.',
    )
  const settled = await readWorldAttackAuthority(userId, characterId)
  if (settled.state.version !== data.version)
    throw new AurevaneError(
      'STALE_VERSION',
      'Your position changed. Try again from the updated map.',
    )
  return settled
}
async function presentWorldData(
  userId: string,
  characterId: string,
  data: Awaited<ReturnType<typeof readWorldData>>,
  viewport?: WorldSceneViewport,
) {
  const objectives = [...WORLD_OBJECTIVES, ...eventWorldObjectives(data.eventObjectives)]
  const state = data.state as WorldState
  // Build the expensive terrain projection once. Only its server-derived scene IDs
  // can widen presence; unsurveyed cells are filtered before images or serialization.
  const view = projectWorld(state, [], data.serverNow, objectives, undefined, viewport)
  const sceneSectorIds = view.sectors.map((sector) => sector.id)
  const [presence, environmentSettings] = await Promise.all([
    (async () => {
      const args = {
        p_user_id: userId,
        p_character_id: characterId,
        p_expected_version: state.version,
        p_scene_sector_ids: sceneSectorIds,
        p_initial_position: newWorldState().position,
      }
      const client = createSupabaseAdminClient()
      const result = await client.rpc('read_world_scene_players_v2', args)
      if (result.error?.code === '42883' || result.error?.code === 'PGRST202')
        return { ...(await client.rpc('read_world_scene_players_v1', args)), live: false }
      return { ...result, live: true }
    })(),
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
  view.players = await resolveWorldPlayerImages(players)
  view.livePresence = presence.live && scene.version === state.version
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
export function commitWorldCommand(
  userId: string,
  characterId: string,
  command: WorldCommand,
  compactMovement?: false,
): Promise<WorldView>
export function commitWorldCommand(
  userId: string,
  characterId: string,
  command: WorldCommand,
  compactMovement: true,
): Promise<WorldMovementReceipt>
export function commitWorldCommand(
  userId: string,
  characterId: string,
  command: WorldCommand,
  compactMovement: boolean,
): Promise<WorldView | WorldMovementReceipt>
export async function commitWorldCommand(
  userId: string,
  characterId: string,
  command: WorldCommand,
  compactMovement = false,
) {
  // Intent resolution needs authority, not terrain/scene/portrait/environment presentation.
  // Keep training materialization in this read and blocking/version checks in the commit RPC.
  const current = await readWorldData(userId, characterId)
  const authorityAt = performance.now()
  const state = current.state as WorldState
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
    if (compactMovement) return movementReceipt(characterId, current)
    return (await presentWorldData(userId, characterId, current)).view
  }
  if (state.version !== command.expectedVersion)
    throw new AurevaneError(
      'STALE_VERSION',
      'Your position changed. Try again from the updated map.',
    )
  if (command.intent.kind === 'attack')
    throw new AurevaneError('INVALID_REQUEST', 'Use the encounter command for attacks.')
  const next = resolveWorldIntent(state, command.intent, current.serverNow, [
    ...WORLD_OBJECTIVES,
    ...eventWorldObjectives(current.eventObjectives),
  ])
  const { data: committed, error } = await createSupabaseAdminClient().rpc(
    'commit_world_state_v1',
    {
      p_user_id: userId,
      p_character_id: characterId,
      p_expected_version: command.expectedVersion,
      p_command_id: command.commandId,
      p_kind: command.intent.kind,
      p_next_state: storedState(next),
      p_request_fingerprint: fingerprint,
    },
  )
  if (error) worldRpcError(error)
  if (compactMovement) {
    if (
      !committed ||
      typeof committed !== 'object' ||
      !Number.isSafeInteger(committed.version) ||
      committed.version <= state.version
    )
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'Movement approval could not be loaded safely.',
      )
    const approved = committedMovementState(committed, state.version + 1)
    if (
      approved &&
      ['walk', 'autopath', 'tick'].includes(command.intent.kind) &&
      !current.blocked &&
      !current.battleSessionId
    ) {
      // SQL returns the normalized state committed under the authority locks.
      // Do not delay its acknowledgement behind another read of peers/events.
      // Existing independent hydration/next commands observe any later block.
      // Elapsed time advances display only; persistence still uses the DB read clock.
      return movementReceipt(characterId, {
        ...current,
        state: approved,
        serverNow: current.serverNow + Math.floor(Math.max(0, performance.now() - authorityAt)),
      })
    }
    // This lean read supplies the database clock and any concurrent blocking state.
    // Presentation is deliberately independent of the mutation response.
    const confirmed = await readWorldData(userId, characterId)
    if ((confirmed.state as WorldState).version < committed.version)
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'Movement approval could not be loaded safely.',
      )
    return movementReceipt(characterId, confirmed)
  }
  return (await readWorld(userId, characterId)).view
}
function committedMovementState(value: unknown, version: number): WorldState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const state = value as Partial<WorldState>
  if (
    state.version !== version ||
    !state.position ||
    typeof state.position.sectorId !== 'string' ||
    !validCell(state.position) ||
    !resolveSector(state.position.sectorId) ||
    !Array.isArray(state.route) ||
    state.route.length > MAX_PERSISTED_ROUTE_STEPS ||
    !state.route.every(
      (step) =>
        step?.position &&
        typeof step.position.sectorId === 'string' &&
        validCell(step.position) &&
        Number.isSafeInteger(step.durationMs) &&
        step.durationMs >= STEP_MS,
    ) ||
    !(
      state.nextStepAt === null ||
      (Number.isSafeInteger(state.nextStepAt) && state.nextStepAt! >= 0)
    ) ||
    (state.route.length > 0 && state.nextStepAt === null) ||
    !state.discoveries ||
    typeof state.discoveries !== 'object' ||
    Array.isArray(state.discoveries) ||
    !Array.isArray(state.completedObjectives)
  )
    return null
  return state as WorldState
}
function movementReceipt(
  characterId: string,
  data: Awaited<ReturnType<typeof readWorldData>>,
): WorldMovementReceipt {
  const state = data.state as WorldState
  // The confirmed origin must be supplied even after a slow reply crosses the
  // previous scene horizon. This is private-filtered terrain, with no scene I/O.
  const sector = resolveSector(state.position.sectorId)
  const currentSector = sector ? projectWorldSector(state, sector) : undefined
  if (!currentSector)
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Movement terrain could not be loaded safely.',
    )
  return {
    kind: 'movement',
    currentSector,
    characterId,
    version: state.version,
    serverNow: data.serverNow,
    position: state.position,
    route: state.route,
    nextStepAt: state.nextStepAt,
    routeObjectiveId: state.route.length ? (state.routeObjectiveId ?? null) : null,
    routeDestination: state.route.length ? (state.routeDestination ?? null) : null,
    battleSessionId: typeof data.battleSessionId === 'string' ? data.battleSessionId : null,
    movementBlocked:
      data.blocked === 'WORLD_TRAINING_ACTIVE'
        ? 'Stop Passive Training to travel.'
        : data.blocked === 'WORLD_SPECTATING'
          ? 'Leave spectating to travel.'
          : data.blocked === 'WORLD_ACTIVE_BATTLE'
            ? 'Return to your active battle.'
            : null,
  }
}
