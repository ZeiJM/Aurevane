import 'server-only'
import { createSelectedCharacterRpc } from './selected-character-rpc'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createMasterActivityService } from './activity-log'
import { createServerMasterPanelStaffAccessService } from './staff-access-server'

export function createServerMasterActivityService() {
  const client = createSupabaseAdminClient()
  return createMasterActivityService(
    createServerMasterPanelStaffAccessService(),
    createSelectedCharacterRpc(async (name, parameters) => {
      const { data, error } = await client.rpc(name, parameters)
      if (error) {
        if (error.code === '42501')
          throw new AurevaneError('FORBIDDEN', 'Activity Log page access is required.')
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'The activity log could not be loaded. Try refreshing.',
        )
      }
      return data
    }),
  )
}
