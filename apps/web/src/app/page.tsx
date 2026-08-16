import { redirect } from 'next/navigation'

import { AccountEntryShell } from '@/components/account/account-entry-shell'
import { getVerifiedAuthClaims } from '@/lib/supabase/auth'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const authConfig = getOptionalPublicSupabaseConfig()

  if (authConfig) {
    const claims = await getVerifiedAuthClaims()

    if (typeof claims?.sub === 'string') {
      redirect('/game')
    }
  }

  return <AccountEntryShell authAvailable={Boolean(authConfig)} />
}
