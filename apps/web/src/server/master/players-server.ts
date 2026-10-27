import 'server-only'
import { throwCombatContentAdmissionError } from '../combat/combat-content-admission-error'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSelectedCharacterRpc } from './selected-character-rpc'
import { createServerMasterPanelStaffAccessService } from './staff-access-server'
import { createMasterPlayersService } from './players-service'

export function createServerMasterPlayersService() {
  const client = createSupabaseAdminClient()
  const rpc = createSelectedCharacterRpc((name, parameters) => client.rpc(name, parameters))
  return createMasterPlayersService(
    createServerMasterPanelStaffAccessService(),
    async (name, parameters) => {
      const { data, error } = await rpc(name, parameters)
      if (error) {
        throwCombatContentAdmissionError(error)
        if (error.code === '42501')
          throw new AurevaneError(
            'FORBIDDEN',
            'Your selected character does not have access to Players.',
          )
        if (error.code === '40001' || error.code === 'PT409' || error.code === '55P03')
          throw new AurevaneError(
            'STALE_VERSION',
            'The player or encounter changed or is busy. Refresh and review again.',
          )
        if (error.message?.includes('PLAYER_BATTLE_ACTIVE'))
          throw new AurevaneError(
            'INVALID_REQUEST',
            'This character is in a battle. End the encounter safely before correcting the build or progression.',
          )
        const sourceRejections: Record<string, string> = {
          CHARACTER_ATTRIBUTE_POINT_POOL_EXCEEDED:
            'This allocation exceeds the personal point pool for the Level provided by the entered XP. Move points between Core Stats or correct XP first.',
          CHARACTER_ATTRIBUTE_BELOW_PRIMARY_BASE:
            'A Core Stat is below the fixed Primary Discipline base. Only personal points can be redistributed.',
          CHARACTER_ATTRIBUTE_DISCIPLINE_CAP_EXCEEDED:
            'A Core Stat exceeds a Primary focus or nonfocus cap. Use the caps shown beside each field.',
          PLAYER_XP_RANGE_INVALID:
            'The entered XP exceeds the current progression cycle’s Level cap.',
        }
        const sourceReason = sourceRejections[error.message ?? '']
        if (sourceReason) throw new AurevaneError('INVALID_REQUEST', sourceReason)
        if (
          error.code === '22023' ||
          /LOCKED|VERSION_CONFLICT|MASTERY_REQUIRED/u.test(error.message ?? '')
        )
          throw new AurevaneError(
            'INVALID_REQUEST',
            'The correction is not legal for the current character. Check earned Skills, Discipline eligibility, Core limits and progression.',
          )
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'Player support could not complete this request.',
        )
      }
      return data
    },
  )
}
