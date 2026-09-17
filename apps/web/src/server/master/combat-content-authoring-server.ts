import 'server-only'

import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'

import {
  createCombatContentAuthoringService,
  type CombatContentAuthoringService,
} from './combat-content-authoring-service'
import { createSupabaseCombatContentAuthoringStore } from './supabase-combat-content-authoring-store'

export function createServerCombatContentAuthoringService(
  actorUserId: string,
): CombatContentAuthoringService {
  return createCombatContentAuthoringService({
    store: createSupabaseCombatContentAuthoringStore(actorUserId),
    resolver: createServerCombatContentResolver(),
  })
}
