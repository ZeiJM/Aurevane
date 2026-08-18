import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AccountEntryShell } from '@/components/account/account-entry-shell'
import { getVerifiedAuthClaims } from '@/lib/supabase/auth'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import {
  ensureActiveGameSession,
  readVerifiedGameSessionIdentity,
} from '@/server/account/active-game-session'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const publicConfig = getOptionalPublicSupabaseConfig()
  const requestHost = (await headers()).get('host')
  const readiness = getCurrentAccountServicesReadiness(publicConfig, requestHost)
  let sessionNotice: string | undefined
  let activeGameSession = false

  if (readiness.available) {
    const claims = await getVerifiedAuthClaims()
    const identity = readVerifiedGameSessionIdentity(claims)

    if (identity) {
      try {
        activeGameSession = await ensureActiveGameSession(identity)
        if (!activeGameSession) {
          sessionNotice =
            'This account continued on another device or login. Sign in here again if you want this screen to take control.'
        }
      } catch {
        sessionNotice = 'Your sign-in exists, but the active game session could not be verified yet.'
      }
    }
  }

  if (activeGameSession) redirect('/game')

  const authConfig =
    readiness.available && publicConfig
      ? { url: publicConfig.url, publishableKey: publicConfig.publishableKey }
      : null

  return <AccountEntryShell authConfig={authConfig} sessionNotice={sessionNotice} />
}
