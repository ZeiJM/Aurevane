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
  imageUrl: string | null
}

const TITLE_PATTERN = /^[A-Za-z0-9 ]+$/

export function CharacterTitleSettings({
  characterId,
  characterName,
  disciplineName,
  personalTitle,
  personalTitleSetAt,
  imageUrl,
}: CharacterTitleSettingsProps) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [confirmedPermanent, setConfirmedPermanent] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [imageDraft, setImageDraft] = useState(imageUrl ?? '')
  const [imagePending, setImagePending] = useState(false)
  const [imageMessage, setImageMessage] = useState<string | null>(null)

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

  async function saveImage() {
    if (imagePending) return
    setImagePending(true)
    setImageMessage(null)
    try {
      const response = await fetch('/api/account/profile-display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, imageUrl: imageDraft.trim() || null }),
      })
      const body = (await response.json()) as {
        display?: { imageUrl?: string | null }
        error?: { message?: string }
      }
      if (!response.ok || !body.display) {
        setImageMessage(body.error?.message ?? 'The profile image could not be saved.')
        return
      }
      setImageDraft(body.display.imageUrl ?? '')
      setImageMessage(body.display.imageUrl ? 'Profile image saved.' : 'Custom profile image removed.')
      router.refresh()
    } catch {
      setImageMessage('The profile display service could not be reached. Nothing was changed.')
    } finally {
      setImagePending(false)
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
          power. The same display identity follows this character across Profile and battle.
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

      <section className={styles.profileImage} aria-labelledby="profile-image-heading">
        <div>
          <span>Character image</span>
          <h2 id="profile-image-heading">Portrait URL</h2>
          <p>
            Paste a direct http(s) image URL. Animated GIFs are supported. The image is cropped,
            never stretched, and follows this character into selection, header, Profile, and battle.
          </p>
        </div>
        {imageDraft.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageDraft.trim()} alt={`${characterName} profile preview`} referrerPolicy="no-referrer" />
        ) : (
          <div className={styles.imagePlaceholder}>No custom image</div>
        )}
        <label className={styles.field}>
          <span>Direct image URL</span>
          <input
            value={imageDraft}
            onChange={(event) => {
              setImageDraft(event.target.value)
              setImageMessage(null)
            }}
            maxLength={2048}
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com/portrait.gif"
            disabled={imagePending}
          />
          <small>Leave blank and save to restore the built-in portrait.</small>
        </label>
        <button
          type="button"
          className={styles.reviewButton}
          onClick={() => void saveImage()}
          disabled={imagePending}
        >
          {imagePending ? 'Saving…' : 'Save Profile Image'}
        </button>
        {imageMessage ? (
          <p className={styles.message} role="status" aria-live="polite">
            {imageMessage}
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
