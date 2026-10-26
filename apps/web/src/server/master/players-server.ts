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
            'Only the Game Owner may inspect or correct players.',
          )
        if (error.code === '40001' || error.code === '55P03')
          throw new AurevaneError(
            'STALE_VERSION',
            'The player or encounter changed or is busy. Refresh and review again.',
          )
        if (error.message?.includes('PLAYER_BATTLE_ACTIVE'))
          throw new AurevaneError(
            'INVALID_REQUEST',
            'This character is in a battle. End the encounter safely before correcting the build or progression.',
          )
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
