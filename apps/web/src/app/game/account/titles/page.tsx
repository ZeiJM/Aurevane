import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AuthenticatedGameRecovery, AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadPlayerProfile } from '@/server/player-profile/player-profile-service'
import { createSupabasePlayerProfileRepository } from '@/server/player-profile/supabase-player-profile-repository'

import styles from '../account-settings.module.css'

export const dynamic = 'force-dynamic'

export default async function AccountTitlesPage() {
  const publicConfig = getOptionalPublicSupabaseConfig()
  const requestHost = (await headers()).get('host')
  const readiness = getCurrentAccountServicesReadiness(publicConfig, requestHost)
  if (!readiness.available) redirect('/')

  let actor
  try {
    actor = await getAuthenticatedActor()
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'UNAUTHENTICATED') redirect('/')
    throw error
  }

  try {
    const profile = await loadPlayerProfile(actor, createSupabasePlayerProfileRepository())
    return (
      <AuthenticatedShellFrame sessionLabel="Account · Titles">
        <div className={styles.page}>
          <header className={styles.header}>
            <span>Account identity</span>
            <h1>Titles</h1>
            <p>
              Account titles are equipped here and appear as compact colored identity badges beside
              your Discipline on the character profile. Titles must be earned before they can be
              equipped; this screen will not invent unearned distinctions.
            </p>
          </header>
          <section className={styles.panel}>
            <div className={styles.titleState}>
              <div>
                <strong>Equipped account title</strong>
                <p>
                  {profile.equippedTitle
                    ? 'Your currently equipped distinction is shown across public character identity surfaces.'
                    : 'No account title has been earned or equipped yet. Earned titles will become selectable here.'}
                </p>
              </div>
              <span className={styles.badge}>{profile.equippedTitle ?? 'None equipped'}</span>
            </div>
          </section>
        </div>
      </AuthenticatedShellFrame>
    )
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE') {
      return <AuthenticatedGameRecovery />
    }
    throw error
  }
}
