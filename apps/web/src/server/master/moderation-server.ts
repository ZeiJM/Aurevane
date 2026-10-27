import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSelectedCharacterRpc } from './selected-character-rpc'
import { createServerMasterPanelStaffAccessService } from './staff-access-server'
import { createMasterModerationService } from './moderation-service'
export function createServerMasterModerationService() {
  const client = createSupabaseAdminClient()
  return createMasterModerationService(
    createServerMasterPanelStaffAccessService(),
    createSelectedCharacterRpc(async (name, params) => {
      const { data, error } = await client.rpc(name, params)
      if (error?.code === '42501')
        throw new AurevaneError(
          'FORBIDDEN',
          error.message.includes('PROTECTED')
            ? 'The Game Owner and your own identity are protected.'
            : 'Moderation page access is required.',
        )
      if (error?.code === 'PT409' || error?.code === '40001')
        throw new AurevaneError(
          'STALE_VERSION',
          'This ban changed. Refresh the player before trying again.',
        )
      if (error?.code === '22023')
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Choose an existing player and a valid duration and reason.',
        )
      if (error)
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'Moderation is unavailable. Try refreshing.',
        )
      return data
    }),
  )
}
