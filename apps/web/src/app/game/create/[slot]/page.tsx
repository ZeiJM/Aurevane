import { isAurevaneError } from '@aurevane/game-core/errors'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CharacterCreationExperience } from '@/components/character/character-creation-experience'
import { AccountMenu } from '@/components/shell/account-menu'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { isCharacterSlotIndex, loadCharacterSlots } from '@/server/character/character-slot-service'

import styles from '@/components/character/character-select-shell.module.css'

export const dynamic = 'force-dynamic'

export default async function CharacterCreationPage({
  params,
}: {
  params: Promise<{ slot: string }>
}) {
  let actor
  try {
    actor = await getAuthenticatedActor()
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'UNAUTHENTICATED') redirect('/')
    throw error
  }

  const { slot } = await params
  const slotIndex = Number(slot)
  if (!isCharacterSlotIndex(slotIndex)) redirect('/game')

  const characters = await loadCharacterSlots(actor.userId)
  if (characters.some((character) => character.slotIndex === slotIndex)) redirect('/game')

  return (
    <div className={styles.shell} data-character-creation-page="true">
      <header className={styles.header}>
        <Link className="brand" href="/game" aria-label="AUREVANE Character Select">
          <span className="brand__crest" aria-hidden="true">
            <span>A</span>
          </span>
          <span className="brand__wordmark">
            <strong>AUREVANE</strong>
            <small>Character Creation</small>
          </span>
        </Link>
        <AccountMenu />
      </header>

      <main className={styles.main}>
        <section className={styles.creationPanel}>
          <div className={styles.creationHeading}>
            <div>
              <span>Slot {slotIndex + 1}</span>
              <h1>Create a new character</h1>
            </div>
            <Link href="/game">← Back to Character Select</Link>
          </div>
          <CharacterCreationExperience slotIndex={slotIndex} />
        </section>
      </main>
    </div>
  )
}
