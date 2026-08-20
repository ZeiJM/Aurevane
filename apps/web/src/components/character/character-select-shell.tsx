'use client'

import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { getFoundationDiscipline } from '@aurevane/game-core/character/foundation-disciplines'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { AccountMenu } from '@/components/shell/account-menu'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { CharacterSlotCharacter } from '@/server/character/character-slot-service'

import styles from './character-select-shell.module.css'

interface CharacterSelectShellProps {
  characters: readonly CharacterSlotCharacter[]
  selectedCharacter: PersistedCharacter | null
  profileImageUrls: Readonly<Record<string, string>>
}

function lockedSlotCopy(slotIndex: number): { title: string; body: string; badge: string } {
  if (slotIndex === 1) {
    return {
      title: 'Additional character slot',
      body: 'Slot 2 will be available for purchase at a later time.',
      badge: 'Available later',
    }
  }
  return {
    title: 'Prestige character slot',
    body: 'Slot 3 unlocks free after this account completes its first Prestige Rebirth.',
    badge: 'Earn free · first Prestige Rebirth',
  }
}

export function CharacterSelectShell({
  characters,
  selectedCharacter,
  profileImageUrls,
}: CharacterSelectShellProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<CharacterSlotCharacter | null>(null)
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const bySlot = useMemo(
    () => new Map(characters.map((character) => [character.slotIndex, character])),
    [characters],
  )
  const prestigeSlotEarned = useMemo(
    () => characters.some((character) => character.progressionCycle.number >= 2),
    [characters],
  )
  const displaySlots = useMemo(
    () =>
      [0, 1, 2]
        .map((slotIndex) => {
          const character = bySlot.get(slotIndex) ?? null
          return {
            slotIndex,
            character,
            unlocked:
              slotIndex === 0 || Boolean(character) || (slotIndex === 2 && prestigeSlotEarned),
          }
        })
        .sort((left, right) => {
          if (left.unlocked !== right.unlocked) return left.unlocked ? -1 : 1
          return left.slotIndex - right.slotIndex
        }),
    [bySlot, prestigeSlotEarned],
  )

  async function requestDeletion() {
    if (!deleting || busy) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/characters/${deleting.id}/deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationPhrase: phrase }),
      })
      const payload = (await response.json()) as { error?: { message?: string } }
      if (!response.ok) {
        setMessage(payload.error?.message ?? 'Deletion could not be scheduled.')
        return
      }
      setDeleting(null)
      setPhrase('')
      router.refresh()
    } catch {
      setMessage('Deletion could not reach the server. Nothing was deleted.')
    } finally {
      setBusy(false)
    }
  }

  async function cancelDeletion(characterId: string) {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/characters/${characterId}/deletion`, { method: 'DELETE' })
      if (!response.ok) throw new Error('cancel failed')
      router.refresh()
    } catch {
      setMessage('The deletion countdown could not be cancelled. Refresh and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className="brand" href="/game" aria-label="AUREVANE Character Select">
          <span className="brand__crest" aria-hidden="true">
            <span>A</span>
          </span>
          <span className="brand__wordmark">
            <strong>AUREVANE</strong>
            <small>Character Select</small>
          </span>
        </Link>

        <div className={styles.headerActions}>
          <div className={styles.screenIdentity} aria-label="Current screen: Character Select">
            {selectedCharacter ? (
              <span className={styles.screenPortrait} title={selectedCharacter.name}>
                <CharacterPortraitImage
                  imageUrl={profileImageUrls[selectedCharacter.id]}
                  fallbackAssetId={getStarterPortraitImageAssetId(selectedCharacter.portraitRef)}
                  className={styles.screenPortraitImage}
                  sizes="2rem"
                  alt=""
                />
              </span>
            ) : null}
            <span className={styles.screenLabel}>
              <i aria-hidden="true" />
              <strong>Character Select</strong>
            </span>
          </div>
          <AccountMenu />
        </div>
      </header>

      <main className={styles.main} style={{ width: 'min(96%, 84rem)' }}>
        <header className={styles.hero}>
          <div>
            <span>Account roster</span>
            <h1>Choose your character.</h1>
          </div>
          <p>
            Every account begins with one free character. Additional unlocked characters are kept
            together at the front of the roster; locked opportunities stay last without changing a
            character&apos;s true stored slot identity.
          </p>
        </header>

        {message ? (
          <p className={styles.message} role="status">
            {message}
          </p>
        ) : null}

        <section className={styles.slots} aria-label="Character slots">
          {displaySlots.map(({ slotIndex, character, unlocked }) => {
            if (!unlocked) {
              const lock = lockedSlotCopy(slotIndex)
              return (
                <article
                  className={`${styles.slot} ${styles.empty}`}
                  data-locked="true"
                  key={slotIndex}
                >
                  <span className={styles.slotNumber}>Slot {slotIndex + 1}</span>
                  <div className={styles.emptyCrest} aria-hidden="true">
                    ◇
                  </div>
                  <h2>{lock.title}</h2>
                  <p>{lock.body}</p>
                  <span className={styles.lockedBadge}>{lock.badge}</span>
                </article>
              )
            }

            if (!character) {
              return (
                <article className={`${styles.slot} ${styles.empty}`} key={slotIndex}>
                  <span className={styles.slotNumber}>
                    Slot {slotIndex + 1} · {slotIndex === 0 ? 'Free' : 'Prestige unlocked'}
                  </span>
                  <div className={styles.emptyCrest} aria-hidden="true">
                    +
                  </div>
                  <h2>Open character slot</h2>
                  <p>
                    {slotIndex === 2
                      ? 'Your first Prestige Rebirth earned this extra character slot for free.'
                      : 'Create your adventurer with their own identity, progression, and build.'}
                  </p>
                  <Link className={styles.primaryAction} href={`/game/create/${slotIndex}`}>
                    Create Character
                  </Link>
                </article>
              )
            }

            const discipline = getFoundationDiscipline(character.foundationDisciplineId)
            const pending = Boolean(character.deletionExecuteAfter)
            return (
              <article
                className={styles.slot}
                key={character.id}
                data-pending-delete={pending || undefined}
              >
                <span className={styles.slotNumber}>Slot {slotIndex + 1} · Unlocked</span>
                <div className={styles.portrait}>
                  <CharacterPortraitImage
                    imageUrl={profileImageUrls[character.id]}
                    fallbackAssetId={getStarterPortraitImageAssetId(character.portraitRef)}
                    sizes="15rem"
                    alt={`${character.name} portrait`}
                  />
                </div>
                <div className={styles.identity}>
                  <h2>{character.name}</h2>
                  <p>
                    Character Level {character.level} · {discipline?.name ?? 'Adventurer'}
                  </p>
                </div>
                {pending && character.deletionExecuteAfter ? (
                  <div className={styles.pendingDelete}>
                    <strong>Deletion pending</strong>
                    <Countdown target={character.deletionExecuteAfter} />
                    <span>This character cannot be played during the grace period.</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void cancelDeletion(character.id)}
                    >
                      Cancel deletion
                    </button>
                  </div>
                ) : (
                  <>
                    <CharacterPlayAction character={character} />
                    <button
                      className={styles.deleteAction}
                      type="button"
                      onClick={() => {
                        setDeleting(character)
                        setPhrase('')
                        setMessage(null)
                      }}
                    >
                      Delete Character
                    </button>
                  </>
                )}
              </article>
            )
          })}
        </section>
      </main>

      {deleting ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !busy) setDeleting(null)
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-character-title"
          >
            <span>24-hour deletion grace period</span>
            <h2 id="delete-character-title">Schedule deletion of {deleting.name}?</h2>
            <p>
              This does not delete the character immediately. The slot stays locked for 24 hours and
              you can cancel during that time. After the deadline the deletion becomes irreversible.
            </p>
            <label>
              <span>
                Type exactly: <strong>DELETE {deleting.name}</strong>
              </span>
              <input
                autoFocus
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                disabled={busy}
              />
            </label>
            {message ? (
              <p className={styles.modalError} role="alert">
                {message}
              </p>
            ) : null}
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setDeleting(null)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => void requestDeletion()}
                disabled={busy || phrase !== `DELETE ${deleting.name}`}
              >
                {busy ? 'Scheduling…' : 'Start 24-hour deletion'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function CharacterPlayAction({ character }: { character: CharacterSlotCharacter }) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())
  const target = character.reselectAvailableAt
    ? new Date(character.reselectAvailableAt).getTime()
    : 0
  const remaining = Math.max(0, target - now)

  useEffect(() => {
    if (!target || target <= Date.now()) return
    const timer = window.setInterval(() => {
      const next = Date.now()
      setNow(next)
      if (next >= target) {
        window.clearInterval(timer)
        router.refresh()
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [router, target])

  if (remaining > 0) {
    return (
      <div className={styles.swapCooldown} aria-live="polite">
        <span>Return cooldown</span>
        <strong>
          <Duration milliseconds={remaining} />
        </strong>
        <small>You can select {character.name} again when this reaches zero.</small>
      </div>
    )
  }

  return (
    <Link className={styles.primaryAction} href={`/game/select/${character.id}`}>
      Play {character.name}
    </Link>
  )
}

function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <b>
      <Duration milliseconds={Math.max(0, new Date(target).getTime() - now)} />
    </b>
  )
}

function Duration({ milliseconds }: { milliseconds: number }) {
  const totalSeconds = Math.ceil(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return (
    <>
      {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:
      {seconds.toString().padStart(2, '0')}
    </>
  )
}
