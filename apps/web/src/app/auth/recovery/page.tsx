import { AccountEntryShell } from '@/components/account/account-entry-shell'
import { PasswordRecoveryLinkPanel } from '@/components/account/password-recovery-link-panel'
import { isPasswordRecoveryTokenHash } from '@/lib/auth/password-recovery'

export const dynamic = 'force-dynamic'

/** GET renders only: mail scanners cannot consume a recovery credential. */
export default async function Recovery({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[] }>
}) {
  const { token_hash } = await searchParams
  return (
    <AccountEntryShell authConfig={null} heading="Reset your password.">
      <PasswordRecoveryLinkPanel
        tokenHash={isPasswordRecoveryTokenHash(token_hash) ? token_hash : null}
      />
    </AccountEntryShell>
  )
}
