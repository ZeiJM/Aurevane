import 'server-only'

import {
  createMasterPanelStaffAccessService,
  createMasterPanelRoleDefaultsService,
  type MasterPanelRoleDefaultsStore,
  type MasterPanelStaffAccessService,
} from './staff-access'
import { createSupabaseMasterPanelStaffAccessStore } from './supabase-staff-access-store'

export function createServerMasterPanelStaffAccessService(): MasterPanelStaffAccessService {
  return createMasterPanelStaffAccessService(createSupabaseMasterPanelStaffAccessStore())
}

export function createServerMasterPanelRoleDefaultsService(): MasterPanelRoleDefaultsStore {
  const store = createSupabaseMasterPanelStaffAccessStore()
  return createMasterPanelRoleDefaultsService(createMasterPanelStaffAccessService(store), store)
}
