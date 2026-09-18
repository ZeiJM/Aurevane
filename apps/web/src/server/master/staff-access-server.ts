import 'server-only'

import {
  createMasterPanelStaffAccessService,
  type MasterPanelStaffAccessService,
} from './staff-access'
import { createSupabaseMasterPanelStaffAccessStore } from './supabase-staff-access-store'

export function createServerMasterPanelStaffAccessService(): MasterPanelStaffAccessService {
  return createMasterPanelStaffAccessService(createSupabaseMasterPanelStaffAccessStore())
}
