import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AccountEntryShell } from '@/components/account/account-entry-shell'
import { getVerifiedAuthClaims } from '@/lib/supabase/auth'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const publicConfig = getOptionalPublicSupabaseConfig()
  const requestHost = (await headers()).get('host')
  const readiness = getCurrentAccountServicesReadiness(publicConfig, requestHost)

  if (readiness.available) {
    const claims = await getVerifiedAuthClaims()

    if (typeof claims?.sub === 'string') {
      redirect('/game')
    }
  }

  const authConfig =
    readiness.available && publicConfig
      ? { url: publicConfig.url, publishableKey: publicConfig.publishableKey }
      : null

  return <AccountEntryShell authConfig={authConfig} />
}
