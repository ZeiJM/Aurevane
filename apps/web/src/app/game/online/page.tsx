import { isAurevaneError } from '@aurevane/game-core/errors'
import { Kicker, Surface } from '@aurevane/ui'
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
      <Surface className={styles.page} tone="elevated" data-character-directory>
        <header className={styles.heading}>
          <Kicker marker="◇">Live presence</Kicker>
        </header>

        <OnlineUsersDirectory characters={online} />
      </Surface>
    </AuthenticatedShellFrame>
  )
}
