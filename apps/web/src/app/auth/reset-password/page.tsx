import { AccountEntryShell } from '@/components/account/account-entry-shell'
import { PasswordResetPanel } from '@/components/account/password-reset-panel'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { hasVerifiedRecoverySession } from '@/lib/auth/recovery-session'
import { headers } from 'next/headers'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'

export const dynamic = 'force-dynamic'

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const config = getOptionalPublicSupabaseConfig()
  const readiness = getCurrentAccountServicesReadiness(config, (await headers()).get('host'))
  const { error: callbackError } = await searchParams
  let verified = false
  if (readiness.available && config && !callbackError) {
    try {
      const supabase = await createSupabaseServerClient()
      verified = await hasVerifiedRecoverySession(supabase)
    } catch {
      /* The recovery panel provides the retry path when Auth is unavailable. */
    }
  }
  return (
    <AccountEntryShell
      authConfig={readiness.available ? config : null}
      heading="Reset your password."
    >
      <PasswordResetPanel verified={verified} />
    </AccountEntryShell>
  )
}
