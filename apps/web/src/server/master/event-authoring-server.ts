import 'server-only'

import { createServerMasterPanelStaffAccessService } from './staff-access-server'
import {
  createEventAuthoringService,
  type EventAuthoringService,
} from './event-authoring-service'
import { createSupabaseEventAuthoringStore } from './supabase-event-authoring-store'

export function createServerEventAuthoringService(actorUserId: string): EventAuthoringService {
  return createEventAuthoringService({
    store: createSupabaseEventAuthoringStore(actorUserId),
    staffAccess: createServerMasterPanelStaffAccessService(),
  })
}
