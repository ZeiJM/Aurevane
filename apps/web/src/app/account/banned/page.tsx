import { redirect } from 'next/navigation'
import { isAurevaneError } from '@aurevane/game-core/errors'
import { AccountBanNotice } from '@/components/account/account-ban-notice'
import { readSelfAccountBanStatus } from '@/server/account/account-ban-status'
export const dynamic = 'force-dynamic'
export default async function AccountBannedPage() {
  let status
  try {
    status = await readSelfAccountBanStatus()
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'UNAUTHENTICATED') redirect('/')
    return (
      <AccountBanNotice
        initialStatus={null}
        initialError="Account status could not be checked. Try again shortly."
      />
    )
  }
  if (!status.active) redirect('/game')
  return <AccountBanNotice initialStatus={status} />
}
