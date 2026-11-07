import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { normalizeMasterPanelOrder } from '@/lib/master-panel-pages'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSelectedCharacterRpc } from './selected-character-rpc'
import { createServerMasterPanelStaffAccessService } from './staff-access-server'
import { createMasterNavigationService } from './master-navigation-service'

export function createServerMasterNavigationService() {
  const client = createSupabaseAdminClient()
  return createMasterNavigationService(
    createServerMasterPanelStaffAccessService(),
    createSelectedCharacterRpc(async (name, args) => {
      let { data, error } = await client.rpc(name, args)
      if (error?.code === 'PGRST202' || error?.code === '42883') {
        const order = args.p_order
        ;({ data, error } = await client.rpc(name.replace('_v2', '_v1'), {
          ...args,
          ...(Array.isArray(order) ? { p_order: order.filter((tab) => tab !== 'npc-design') } : {}),
        }))
        if (!error && data && typeof data === 'object' && Array.isArray(data.order)) {
          data = { ...data, order: normalizeMasterPanelOrder(data.order) }
        }
      }
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
