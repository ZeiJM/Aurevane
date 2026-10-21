import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'

/** Resolve on every protected operation. Neither a submitted actor nor a
 * submitted character establishes authority. SQL rechecks ownership and grants. */
export async function selectedStaffRpcParameters(
  parameters: Readonly<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const actor = await getAuthenticatedActor()
  const expectedUserId = parameters.p_actor_user_id ?? parameters.p_user_id ?? parameters.p_actor
  if (expectedUserId !== actor.userId) {
    throw new AurevaneError(
      'FORBIDDEN',
      'The current staff identity changed. Refresh and try again.',
    )
  }
  const character = await loadSelectedCharacter(actor)
  if (!character) {
    throw new AurevaneError('FORBIDDEN', 'Select a playable character to use the Master Panel.')
  }
  return { ...parameters, p_actor_character_id: character.id }
}

export async function callSelectedStaffRpc<T>(
  rpc: (name: string, parameters: Record<string, unknown>) => PromiseLike<T>,
  name: string,
  parameters: Readonly<Record<string, unknown>>,
): Promise<T> {
  return rpc(name, await selectedStaffRpcParameters(parameters))
}
