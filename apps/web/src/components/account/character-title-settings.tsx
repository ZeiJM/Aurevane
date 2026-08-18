'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import styles from './character-title-settings.module.css'

interface CharacterTitleSettingsProps {
  characterId: string
  characterName: string
  disciplineName: string
  personalTitle: string | null
  personalTitleSetAt: string | null
}

const TITLE_PATTERN = /^[A-Za-z0-9 ]+$/

export function CharacterTitleSettings({
  characterId,
  characterName,
  disciplineName,
  personalTitle,
  personalTitleSetAt,
}: CharacterTitleSettingsProps) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [confirmedPermanent, setConfirmedPermanent] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const normalizedDraft = useMemo(() => draft.trim().replace(/\s+/g, ' '), [draft])
  const valid =
    normalizedDraft.length >= 1 &&
    normalizedDraft.length <= 20 &&
    TITLE_PATTERN.test(normalizedDraft)

  async function confirmTitle() {
    if (!valid || !confirmedPermanent || pending || personalTitleSetAt) return
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/account/titles/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, title: normalizedDraft }),
      })
      const body = (await response.json()) as {
        title?: { personalTitle?: string }
        error?: { message?: string }
      }
      if (!response.ok || !body.title?.personalTitle) {
        setMessage(body.error?.message ?? 'The title could not be confirmed.')
        return
      }
      setMessage(`${body.title.personalTitle} is now ${characterName}'s personal title.`)
      router.refresh()
    } catch {
      setMessage('The title service could not be reached. Nothing was changed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.layout}>
      <section className={styles.current} aria-labelledby="current-title-heading">
        <div className={styles.headingLine}>
          <div>
            <span>Current profile display</span>
            <h2 id="current-title-heading">{characterName}</h2>
          </div>
          <div className={styles.pills} aria-label="Profile identity badges">
            <span className={styles.disciplinePill}>{disciplineName}</span>
            {personalTitle ? <span className={styles.titlePill}>{personalTitle}</span> : null}
          </div>
        </div>
        <p>
          Discipline and title are identity labels. Neither grants stats, permissions, or combat
          power. The title shown here is the same title displayed beside this character on Profile.
        </p>
      </section>

      <section className={styles.personal} aria-labelledby="personal-title-heading">
        <header>
          <div>
            <span>Personal title</span>
            <h2 id="personal-title-heading">One character, one personal title choice.</h2>
          </div>
          <strong>{personalTitleSetAt ? 'Choice used' : 'Available'}</strong>
        </header>

        {personalTitleSetAt && personalTitle ? (
          <div className={styles.lockedState}>
            <span>Confirmed title</span>
            <strong>{personalTitle}</strong>
            <p>
              This character has used its one personal-title opportunity. The title is permanent as
              a personal identity record; future earned prestige distinctions can occupy the visible
              title slot when that progression system unlocks.
            </p>
          </div>
        ) : (
          <>
            <p className={styles.explanation}>
              Choose 1–20 characters using letters, numbers, and spaces. AUREVANE checks the title
              for collisions before committing it. You can review the exact display before the final
              server-authoritative confirmation.
            </p>

            <label className={styles.field}>
              <span>Personal title</span>
              <input
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value)
                  setReviewing(false)
                  setConfirmedPermanent(false)
                  setMessage(null)
                }}
                maxLength={20}
                autoComplete="off"
                placeholder="e.g. Dawn Warden"
                aria-invalid={draft.length > 0 && !valid ? true : undefined}
                disabled={pending}
              />
              <small>{normalizedDraft.length}/20 · letters, numbers, spaces</small>
            </label>

            {!reviewing ? (
              <button
                type="button"
                className={styles.reviewButton}
                disabled={!valid || pending}
                onClick={() => setReviewing(true)}
              >
                Review Title
              </button>
            ) : (
              <div className={styles.confirmation}>
                <span>Final profile preview</span>
                <div className={styles.previewName}>
                  <strong>{characterName}</strong>
                  <div className={styles.pills}>
                    <span className={styles.disciplinePill}>{disciplineName}</span>
                    <span className={styles.titlePill}>{normalizedDraft}</span>
                  </div>
                </div>
                <label className={styles.confirmCheck}>
                  <input
                    type="checkbox"
                    checked={confirmedPermanent}
                    onChange={(event) => setConfirmedPermanent(event.target.checked)}
                    disabled={pending}
                  />
                  <span>
                    I understand this is this character&apos;s one personal-title choice and cannot
                    be repeatedly edited.
                  </span>
                </label>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.quietButton}
                    disabled={pending}
                    onClick={() => {
                      setReviewing(false)
                      setConfirmedPermanent(false)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.confirmButton}
                    disabled={!confirmedPermanent || pending}
                    onClick={() => void confirmTitle()}
                  >
                    {pending ? 'Confirming…' : 'Confirm Final Title'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {message ? (
          <p className={styles.message} role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
      </section>

      <section className={styles.future}>
        <span>Distinctions &amp; prestige titles</span>
        <p>
          Earned titles and distinctions will appear here as their progression sources come online.
          They will use the same profile-display area without turning titles into stat bonuses.
        </p>
      </section>
    </div>
  )
}
