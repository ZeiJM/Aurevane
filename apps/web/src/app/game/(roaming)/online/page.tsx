import { isAurevaneError } from '@aurevane/game-core/errors'
import { redirect } from 'next/navigation'

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
    <section
      className={styles.page}
      data-character-directory
      data-av-surface="ink"
      data-online-concept="true"
      data-directory-stage="true"
    >
      <OnlineUsersDirectory characters={online} />
    </section>
  )
}
