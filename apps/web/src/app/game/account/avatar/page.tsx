import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AvatarSettings } from '@/components/account/avatar-settings'
import { AuthenticatedGameRecovery, AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadPlayerProfile } from '@/server/player-profile/player-profile-service'
import { createSupabasePlayerProfileRepository } from '@/server/player-profile/supabase-player-profile-repository'

import styles from '../account-settings.module.css'

export const dynamic = 'force-dynamic'

export default async function AccountAvatarPage() {
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
      <AuthenticatedShellFrame sessionLabel="Account · Avatar">
        <div className={styles.page}>
          <header className={styles.header}>
            <span>Account identity</span>
            <h1>Avatar</h1>
            <p>
              Paste a direct HTTPS image URL to use one visual identity across your profile,
              authenticated AUREVANE crest, and battle presentation. Animated GIFs are supported.
            </p>
          </header>
          <div className={styles.panel}>
            <AvatarSettings initialAvatarUrl={profile.avatarUrl} />
          </div>
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
