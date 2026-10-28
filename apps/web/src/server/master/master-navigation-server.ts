import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSelectedCharacterRpc } from './selected-character-rpc'
import { createServerMasterPanelStaffAccessService } from './staff-access-server'
import { createMasterNavigationService } from './master-navigation-service'

export function createServerMasterNavigationService() {
  const client = createSupabaseAdminClient()
  return createMasterNavigationService(
    createServerMasterPanelStaffAccessService(),
    createSelectedCharacterRpc(async (name, args) => {
      const { data, error } = await client.rpc(name, args)
      if (error?.code === '42501')
        throw new AurevaneError('FORBIDDEN', 'Only the Game Owner can arrange Master Panel tabs.')
      if (error?.code === 'PT409')
        throw new AurevaneError(
          'STALE_VERSION',
          'Tab order changed. Refresh this page before saving again.',
        )
      if (error?.code === '22023')
        throw new AurevaneError('INVALID_REQUEST', 'Choose each Master Panel tab once.')
      if (error)
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'Tab order is unavailable. Try refreshing.',
        )
      return data
    }),
  )
}
