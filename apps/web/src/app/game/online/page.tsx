import { isAurevaneError } from '@aurevane/game-core/errors'
import { Kicker, Surface } from '@aurevane/ui'
import { redirect } from 'next/navigation'

import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { listOnlineCharacters, touchCharacterPresence } from '@/server/presence/character-presence-service'

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
      <Surface className={styles.page} tone="elevated">
        <header className={styles.heading}>
          <div>
            <Kicker marker="◇">Live presence</Kicker>
            <h1>Online Users</h1>
            <p>
              Characters remain listed while they are active and for up to ten minutes after their
              last presence heartbeat.
            </p>
          </div>
          <strong>{online.length}</strong>
        </header>

        <div className={styles.list}>
          {online.length === 0 ? (
            <p className={styles.empty}>No characters are currently visible online.</p>
          ) : (
            online.map((character) => (
              <article key={character.characterId}>
                <span className={styles.presenceDot} aria-hidden="true" />
                <div>
                  <strong>{character.name}</strong>
                  <small>Character Level {character.level}</small>
                </div>
                <time dateTime={character.lastSeenAt}>Online</time>
              </article>
            ))
          )}
        </div>
      </Surface>
    </AuthenticatedShellFrame>
  )
}
