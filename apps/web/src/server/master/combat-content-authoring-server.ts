import 'server-only'
import { createCombatContentRecordCommand } from './combat-content-record-command'

import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'

import {
  createCombatContentAuthoringService,
  type CombatContentAuthoringService,
} from './combat-content-authoring-service'
import { createSupabaseCombatContentAuthoringStore } from './supabase-combat-content-authoring-store'

export function createServerCombatContentAuthoringService(
  actorUserId: string,
): CombatContentAuthoringService {
  const store = createSupabaseCombatContentAuthoringStore(actorUserId)
  const service = createCombatContentAuthoringService({
    store,
    resolver: createServerCombatContentResolver(),
  })
  return {
    ...service,
    recordCommand: createCombatContentRecordCommand(store, service, actorUserId),
  }
}
