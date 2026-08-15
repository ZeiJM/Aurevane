import 'server-only'

import { createSupabaseServerClient } from './server'

export async function getVerifiedAuthClaims() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    return null
  }

  return data.claims
}
