import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { getVerifiedAuthClaims } from '@/lib/supabase/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { parseAccountBanStatus } from '@/lib/account-ban-status'
import { readVerifiedGameSessionIdentity } from './active-game-session'

/** A valid signed session may read only its own ban, without a gameplay lease. */
export async function readSelfAccountBanStatus() {
  const identity = readVerifiedGameSessionIdentity(await getVerifiedAuthClaims())
  if (!identity) throw new AurevaneError('UNAUTHENTICATED', 'Sign in to check your account status.')
  const { data, error } = await createSupabaseAdminClient().rpc('read_account_ban_status_v1', {
    p_user_id: identity.userId,
  })
  if (error?.code === '42501')
    throw new AurevaneError('UNAUTHENTICATED', 'Sign in to check your account status.')
  try {
    if (error) throw error
    return parseAccountBanStatus(data)
  } catch {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Account status could not be checked. Try again shortly.',
    )
  }
}
