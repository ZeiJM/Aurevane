import 'server-only'
import {
  isStarterCharacterPortraitRef,
  STARTER_CHARACTER_PORTRAITS,
} from '@aurevane/game-core/character/starter-options'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getStarterPortraitImageAssetId } from '@/media/character'
import { getImageAsset } from '@/media/registry'
import { isSafe, newWorldState } from '@/world/travel'
import type { WorldCommand, WorldPlayer, WorldState } from '@/world/types'
import { eventWorldObjectives } from './world-events'
import { WORLD_OBJECTIVES, WORLD_SECTORS } from './world-content'
import { projectWorld, resolveWorldIntent } from './world-service'

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
  const sector = WORLD_SECTORS.find((s) => s.id === state.position.sectorId)
  if (!sector)
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'This location cannot be loaded safely.')
  return { ...state, safe: isSafe(sector, state.position) }
}
export async function readWorld(userId: string, characterId: string) {
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
  const objectives = [...WORLD_OBJECTIVES, ...eventWorldObjectives(data.eventObjectives)]
  const state = data.state as WorldState
  const view = projectWorld(
    state,
    (data.players as WorldPlayer[]).map((player) => ({
      ...player,
      imageUrl:
        getImageAsset(
          getStarterPortraitImageAssetId(
            isStarterCharacterPortraitRef(player.portraitRef)
              ? player.portraitRef
              : STARTER_CHARACTER_PORTRAITS[0]!.ref,
          ),
        ).src ?? null,
    })),
    data.serverNow,
    objectives,
  )
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
  return { state, view, objectives }
}
export async function commitWorldCommand(
  userId: string,
  characterId: string,
  command: WorldCommand,
) {
  const current = await readWorld(userId, characterId)
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
  if (command.intent.kind === 'tick' && JSON.stringify(next) === JSON.stringify(current.state))
    return current.view
  const { error } = await createSupabaseAdminClient().rpc('commit_world_state_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_expected_version: command.expectedVersion,
    p_command_id: command.commandId,
    p_kind: command.intent.kind,
    p_next_state: storedState(next),
  })
  if (error) worldRpcError(error)
  return (await readWorld(userId, characterId)).view
}
