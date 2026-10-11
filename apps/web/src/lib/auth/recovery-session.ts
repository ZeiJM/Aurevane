import 'server-only'

import { cookies } from 'next/headers'
import type { createSupabaseServerClient } from '@/lib/supabase/server'

export const PASSWORD_RECOVERY_COOKIE = 'aurevane-password-recovery'

export async function hasVerifiedRecoverySession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<boolean> {
  const marker = (await cookies()).get(PASSWORD_RECOVERY_COOKIE)?.value
  if (!marker) return false
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user?.email_confirmed_at) return false
  const { data, error } = await supabase.auth.getClaims()
  return (
    !error &&
    data?.claims.sub === userData.user.id &&
    typeof data.claims.session_id === 'string' &&
    data.claims.session_id === marker
  )
}
