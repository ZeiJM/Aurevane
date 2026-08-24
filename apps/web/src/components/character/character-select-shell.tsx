'use client'

import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { getFoundationDiscipline } from '@aurevane/game-core/character/foundation-disciplines'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { AccountMenu } from '@/components/shell/account-menu'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { AccountDeletionState } from '@/server/account/account-deletion-service'
import type { CharacterSlotCharacter } from '@/server/character/character-slot-service'

import styles from './character-select-shell.module.css'

interface CharacterSelectShellProps {
  characters: readonly CharacterSlotCharacter[]
  selectedCharacter: PersistedCharacter | null
  profileImageUrls: Readonly<Record<string, string>>
  accountDeletion: AccountDeletionState | null
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
  accountDeletion,
}: CharacterSelectShellProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<CharacterSlotCharacter | null>(null)
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [accountDeletionState, setAccountDeletionState] = useState(accountDeletion)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [accountPassword, setAccountPassword] = useState('')
  const [accountBusy, setAccountBusy] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
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

  async function startAccountDeletion() {
    if (!accountPassword || accountBusy) return
    setAccountBusy(true)
    setAccountError(null)

    try {
      const response = await fetch('/api/account/deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: accountPassword }),
      })
      const payload = (await response.json()) as {
        pending?: AccountDeletionState
        error?: { message?: string }
      }

      if (!response.ok || !payload.pending) {
        setAccountError(
          payload.error?.message ?? 'Account deletion could not be scheduled. Nothing was deleted.',
        )
        return
      }

      setAccountDeletionState(payload.pending)
      setAccountPassword('')
      setAccountModalOpen(false)
      router.refresh()
    } catch {
      setAccountError('Account deletion could not reach the server. Nothing was deleted.')
    } finally {
      setAccountBusy(false)
    }
  }

  async function cancelAccountDeletion() {
    if (accountBusy) return
    setAccountBusy(true)
    setAccountError(null)

    try {
      const response = await fetch('/api/account/deletion', { method: 'DELETE' })
      const payload = (await response.json()) as {
        cancelled?: boolean
        error?: { message?: string }
      }

      if (!response.ok || payload.cancelled !== true) {
        setAccountError(
          payload.error?.message ??
            'The account deletion countdown could not be cancelled. Refresh and try again.',
        )
        return
      }

      setAccountDeletionState(null)
      setAccountModalOpen(false)
      router.refresh()
    } catch {
      setAccountError('The account deletion countdown could not reach the server. Try again.')
    } finally {
      setAccountBusy(false)
    }
  }

  function openAccountDeletionModal() {
    setAccountPassword('')
    setAccountError(null)
    setAccountModalOpen(true)
  }

  return (
    <div className={styles.shell} data-character-select-page="true">
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

        <div className="account-delete-header-control">
          <button
            type="button"
            className="account-delete-header-button"
            data-pending={accountDeletionState ? 'true' : undefined}
            data-testid="delete-account-button"
            onClick={openAccountDeletionModal}
          >
            {accountDeletionState ? (
              <>
                <span>Account deletion</span>
                <Countdown target={accountDeletionState.deleteAfter} />
              </>
            ) : (
              'Delete Account'
            )}
          </button>
        </div>

        <div className={`${styles.headerActions} character-select-header-actions`}>
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
          </div>
          <AccountMenu />
        </div>
      </header>

      <main className={styles.main} style={{ width: 'min(94%, 78rem)' }}>
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

      {accountModalOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !accountBusy) setAccountModalOpen(false)
          }}
        >
          <section
            className={`${styles.modal} account-delete-modal`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            {accountDeletionState ? (
              <>
                <span>Account deletion scheduled</span>
                <h2 id="delete-account-title">Your account is in its 24-hour grace period.</h2>
                <div className="account-delete-countdown" aria-live="polite">
                  <small>Permanent deletion in</small>
                  <Countdown target={accountDeletionState.deleteAfter} />
                </div>
                <p>
                  When this timer expires, your AUREVANE login email and authentication identity,
                  characters, progression, settings, training data, battle records, PvP data, and
                  other account-owned game records are permanently deleted. Recovery is not possible
                  after finalization.
                </p>
                <p>
                  You can still change your mind now. Cancelling immediately removes the request.
                </p>
                {accountError ? (
                  <p className={styles.modalError} role="alert">
                    {accountError}
                  </p>
                ) : null}
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setAccountModalOpen(false)}
                    disabled={accountBusy}
                  >
                    Keep deletion scheduled
                  </button>
                  <button
                    type="button"
                    className="account-cancel-deletion"
                    onClick={() => void cancelAccountDeletion()}
                    disabled={accountBusy}
                  >
                    {accountBusy ? 'Cancelling…' : 'Cancel account deletion'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <span>Permanent account deletion</span>
                <h2 id="delete-account-title">Delete your entire AUREVANE account?</h2>
                <p className="account-delete-warning">
                  This action becomes irreversible after the 24-hour grace period. Final deletion
                  removes your login email and authentication identity plus all AUREVANE data owned
                  by this account. It cannot be restored from the game database afterward.
                </p>
                <p>
                  To start the countdown, verify that you are the account owner by entering your
                  current account password. Nothing is deleted when you open this warning.
                </p>
                <label>
                  <span>Current account password</span>
                  <input
                    autoFocus
                    type="password"
                    autoComplete="current-password"
                    value={accountPassword}
                    onChange={(event) => setAccountPassword(event.target.value)}
                    disabled={accountBusy}
                  />
                </label>
                {accountError ? (
                  <p className={styles.modalError} role="alert">
                    {accountError}
                  </p>
                ) : null}
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setAccountModalOpen(false)}
                    disabled={accountBusy}
                  >
                    Never mind
                  </button>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => void startAccountDeletion()}
                    disabled={accountBusy || accountPassword.length === 0}
                  >
                    {accountBusy ? 'Verifying…' : 'Start 24-hour account deletion'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      <style jsx global>{`
        .account-delete-header-control {
          position: absolute;
          left: 50%;
          z-index: 2;
          transform: translateX(-50%);
        }

        .account-delete-header-button {
          display: inline-flex;
          min-height: 2.2rem;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.48rem 0.82rem;
          border: 1px solid rgba(200, 125, 121, 0.78);
          border-radius: var(--av-radius-sm);
          color: #f4d5d3;
          background: linear-gradient(180deg, rgba(137, 55, 55, 0.94), rgba(92, 38, 38, 0.96));
          box-shadow: 0 0 0 1px rgba(200, 125, 121, 0.08) inset;
          font: 750 0.55rem/1 var(--av-font-mono);
          letter-spacing: 0.055em;
          text-transform: uppercase;
          cursor: pointer;
        }

        .account-delete-header-button:hover {
          border-color: rgba(224, 151, 146, 0.95);
          background: linear-gradient(180deg, rgba(158, 64, 64, 0.98), rgba(106, 42, 42, 0.98));
        }

        .account-delete-header-button[data-pending='true'] {
          border-color: rgba(218, 157, 151, 0.9);
          background: rgba(111, 42, 42, 0.9);
        }

        .account-delete-header-button b {
          color: #fff3f1;
          font-size: 0.62rem;
          letter-spacing: 0.04em;
        }

        .account-delete-countdown {
          display: grid;
          gap: 0.28rem;
          margin: 0.85rem 0;
          padding: 0.8rem;
          border: 1px solid rgba(200, 125, 121, 0.45);
          border-radius: var(--av-radius-sm);
          background: rgba(111, 42, 42, 0.12);
          text-align: center;
        }

        .account-delete-countdown small {
          color: var(--av-danger-400);
          font: 750 0.55rem/1 var(--av-font-mono);
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .account-delete-countdown b {
          color: #f6dfdd;
          font: 600 1.65rem/1 var(--av-font-display);
          letter-spacing: 0.04em;
        }

        .account-delete-warning {
          padding: 0.7rem;
          border-left: 2px solid var(--av-danger-400);
          background: rgba(200, 125, 121, 0.075);
          color: #e7c2bf !important;
        }

        .account-delete-modal .account-cancel-deletion {
          border-color: rgba(120, 181, 154, 0.58);
          color: #b9dfce;
          background: rgba(120, 181, 154, 0.09);
        }

        @media (max-width: 760px) {
          .account-delete-header-control {
            position: static;
            margin-left: auto;
            transform: none;
          }

          .account-delete-header-button {
            min-height: 2rem;
            padding-inline: 0.55rem;
            font-size: 0.48rem;
          }

          .account-delete-header-button[data-pending='true'] > span {
            display: none;
          }
        }

        @media (max-width: 560px) {
          .character-select-header-actions {
            gap: 0.72rem !important;
          }

          .account-delete-header-control {
            margin-left: 0;
          }

          .account-delete-header-button {
            max-width: 7.5rem;
          }
        }
      `}</style>
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
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())
  const targetTime = new Date(target).getTime()
  const remaining = Math.max(0, targetTime - now)

  useEffect(() => {
    if (targetTime <= Date.now()) return
    const timer = window.setInterval(() => {
      const next = Date.now()
      setNow(next)
      if (next >= targetTime) {
        window.clearInterval(timer)
        router.refresh()
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [router, targetTime])

  return (
    <b>
      <Duration milliseconds={remaining} />
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
      {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
      {String(seconds).padStart(2, '0')}
    </>
  )
}
