import 'server-only'

import { createServerMasterPanelStaffAccessService } from './staff-access-server'
import {
  createEventOperationsService,
  type EventOperationsService,
} from './event-operations-service'
import { createSupabaseEventOperationsStore } from './supabase-event-operations-store'

export function createServerEventOperationsService(): EventOperationsService {
  return createEventOperationsService({
    store: createSupabaseEventOperationsStore(),
    staffAccess: createServerMasterPanelStaffAccessService(),
  })
}
