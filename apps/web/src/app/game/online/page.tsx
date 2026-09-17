import { isAurevaneError } from '@aurevane/game-core/errors'
import { Kicker } from '@aurevane/ui'
import { redirect } from 'next/navigation'

import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { OnlineUsersDirectory } from '@/components/social/online-users-directory'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import {
  listOnlineCharacters,
  touchCharacterPresence,
} from '@/server/presence/character-presence-service'

import styles from './online-users.module.css'

export const dynamic = 'force-dynamic'

export default async function OnlineUsersPage() {
  let actor
  try {
    actor = await getAuthenticatedActor()
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'UNAUTHENTICATED') redirect('/')
    throw error
  }

  const selected = await loadSelectedCharacter(actor)
  if (!selected) redirect('/game')
  await touchCharacterPresence(actor.userId, selected.id)
  const online = await listOnlineCharacters()

  return (
    <AuthenticatedShellFrame
      sessionLabel="Online Users"
      backHref="/game/character"
      backLabel="Back to Character Profile"
    >
      <section
        className={styles.page}
        data-character-directory
        data-av-surface="ink"
        data-online-concept="true"
        data-directory-stage="true"
      >
        <header className={styles.heading}>
          <div>
            <Kicker marker="◇">The realm, together</Kicker>
            <h1>Online Users</h1>
            <p>Real adventurers. A shared journey.</p>
          </div>
          <span className={styles.onlineCount}>
            <i aria-hidden="true" />
            {online.length} online
          </span>
        </header>

        <OnlineUsersDirectory characters={online} />
      </section>
    </AuthenticatedShellFrame>
  )
}
