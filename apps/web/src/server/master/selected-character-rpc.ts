import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'

/** Only staff entrypoints take selected actor context. Player/history and worker RPCs do not. */
const SELECTED_ACTOR_RPCS = new Set([
  'read_master_panel_access_v1',
  'read_master_panel_operator_v1',
  'read_combat_content_draft_v1',
  'list_combat_content_versions_v1',
  'save_combat_content_draft_v1',
  'publish_combat_content_v3',
  'set_combat_content_publication_v2',
  'read_event_definition_draft_v1',
  'save_event_definition_draft_v1',
  'list_event_definition_versions_v1',
  'publish_event_definition_v2',
  'schedule_event_run_v2',
  'cancel_scheduled_event_run_v2',
  'list_event_operation_runs_v1',
  'read_event_operation_dashboard_v1',
  'operate_event_run_v2',
  'advance_event_run_phase_v2',
  'complete_event_cleanup_requirement_v2',
])
interface ActorDependencies {
  getActor(): Promise<{ userId: string }>
  loadSelection(actor: { userId: string }): Promise<{ id: string } | null>
}
export function createSelectedCharacterRpc<T>(
  rpc: (name: string, parameters: Readonly<Record<string, unknown>>) => PromiseLike<T>,
  dependencies: ActorDependencies = {
    getActor: getAuthenticatedActor,
    loadSelection: loadSelectedCharacter,
  },
): (name: string, parameters: Readonly<Record<string, unknown>>) => Promise<T> {
  return async (name, parameters) => {
    if (!SELECTED_ACTOR_RPCS.has(name)) return rpc(name, parameters)
    const actor = await dependencies.getActor()
    const expectedUser = parameters.p_actor_user_id ?? parameters.p_user_id
    if (expectedUser !== actor.userId) {
      throw new AurevaneError('FORBIDDEN', 'Master Panel actor context changed unexpectedly.')
    }
    const selected = await dependencies.loadSelection(actor)
    return rpc(name, { ...parameters, p_actor_character_id: selected?.id ?? null })
  }
}
