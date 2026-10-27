import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { createServerMasterPanelStaffAccessService } from './staff-access-server'
import { createUsageBalanceService } from './usage-balance'
export function createServerUsageBalanceService() {
  return createUsageBalanceService(
    createServerMasterPanelStaffAccessService(),
    async (name, parameters) => {
      const actor = await getAuthenticatedActor()
      if (actor.userId !== parameters.p_actor_user_id)
        throw new AurevaneError('FORBIDDEN', 'Master Panel actor context changed unexpectedly.')
      const selected = await loadSelectedCharacter(actor)
      const { data, error } = await createSupabaseAdminClient().rpc(name, {
        ...parameters,
        p_actor_character_id: selected?.id ?? null,
      })
      if (error)
        throw new AurevaneError(
          error.code === '42501' ? 'FORBIDDEN' : 'PERSISTENCE_UNAVAILABLE',
          error.code === '42501'
            ? 'Game Content access is not available to this character.'
            : 'Usage & Balance could not be loaded. Try refreshing.',
        )
      return data
    },
  )
}
