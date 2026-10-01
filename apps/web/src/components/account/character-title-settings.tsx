'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { SettingsScene } from '@/components/settings/settings-scene'
import styles from './character-title-settings.module.css'

interface CharacterTitleSettingsProps {
  characterId: string
  characterName: string
  disciplineName: string
  personalTitle: string | null
  personalTitleSetAt: string | null
  imageUrl: string | null
  portraitRef?: CharacterPortraitRef
}

const TITLE_PATTERN = /^[A-Za-z0-9 ]+$/

function imageHostPageMessage(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const hostname = new URL(trimmed).hostname.toLowerCase()
    if (hostname === 'ibb.co' || hostname === 'www.ibb.co' || hostname === 'imgbb.com') {
      return 'That is an image-host page, not the image itself. On ImgBB, copy the Direct link; it normally begins with https://i.ibb.co/.'
    }
  } catch {
    return null
  }
  return null
}

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
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false)

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
    const hostPageMessage = imageHostPageMessage(imageDraft)
    if (hostPageMessage) {
      setImageMessage(hostPageMessage)
      return
    }

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
      setImagePreviewFailed(false)
      setImageMessage(
        body.display.imageUrl ? 'Profile image saved.' : 'Custom profile image removed.',
      )
      router.refresh()
    } catch {
      setImageMessage('The profile display service could not be reached. Nothing was changed.')
    } finally {
      setImagePending(false)
    }
  }

  const currentHostMessage = imageHostPageMessage(imageDraft)

  return (
    <SettingsScene title="Portrait & Title" description="Carry the marks of your journey.">
      <div className={styles.layout} data-character-concept="titles" data-av-surface="moonstone">
        <section className={styles.personal} aria-labelledby="personal-title-heading">
          <header>
            <div>
              <span>Personal title</span>
              <h2 id="personal-title-heading">Choose your personal title.</h2>
            </div>
            <strong>{personalTitleSetAt ? 'Choice used' : 'Available'}</strong>
          </header>

          {personalTitleSetAt && personalTitle ? (
            <div className={styles.lockedState}>
              <span>Confirmed title</span>
              <strong>{personalTitle}</strong>
              <p>
                Your one personal-title choice is confirmed. This identity record is permanent;
                future earned distinctions can use the visible title slot.
              </p>
            </div>
          ) : !reviewing ? (
            <>
              <p className={styles.explanation}>
                Choose 1–20 characters using letters, numbers, and spaces. Review the exact display
                before confirming your one personal-title choice.
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

              <button
                type="button"
                className={styles.reviewButton}
                disabled={!valid || pending}
                onClick={() => setReviewing(true)}
              >
                Review Title
              </button>
            </>
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
                  I understand this is this character&apos;s one personal-title choice and cannot be
                  repeatedly edited.
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
              Direct JPG, PNG, WebP or GIF link; square-cropped. Use 128–4096 px artwork, up to 8 MB
              static or 12 MB GIF.
            </p>
          </div>
          {imageDraft.trim() && !imagePreviewFailed && !currentHostMessage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageDraft.trim()}
              alt={`${characterName} profile preview`}
              referrerPolicy="no-referrer"
              onError={() => {
                setImagePreviewFailed(true)
                setImageMessage(
                  'That URL did not load as an image. Copy the direct image link from your host, then try again.',
                )
              }}
            />
          ) : (
            <div className={styles.imagePlaceholder}>
              {imagePreviewFailed || currentHostMessage
                ? 'Direct image required'
                : 'No custom image'}
            </div>
          )}
          <label className={styles.field}>
            <span>Direct image URL</span>
            <input
              value={imageDraft}
              onChange={(event) => {
                setImageDraft(event.target.value)
                setImagePreviewFailed(false)
                setImageMessage(null)
              }}
              maxLength={2048}
              inputMode="url"
              autoComplete="url"
              placeholder="https://i.ibb.co/.../portrait.png"
              disabled={imagePending}
              aria-invalid={currentHostMessage ? true : undefined}
            />
            <small>
              ImgBB: use “Direct link” (i.ibb.co). Leave blank and save to restore your built-in
              portrait.
            </small>
          </label>
          <button
            type="button"
            className={styles.reviewButton}
            onClick={() => void saveImage()}
            disabled={imagePending || Boolean(currentHostMessage)}
          >
            {imagePending ? 'Saving…' : 'Save Profile Image'}
          </button>
          {currentHostMessage ? <p className={styles.message}>{currentHostMessage}</p> : null}
          {imageMessage && imageMessage !== currentHostMessage ? (
            <p className={styles.message} role="status" aria-live="polite">
              {imageMessage}
            </p>
          ) : null}
        </section>

        <section className={styles.future}>
          <span>Distinctions &amp; prestige titles</span>
          <p>
            Earned titles and distinctions will appear as progression sources unlock. Titles grant
            no stat bonuses.
          </p>
        </section>
      </div>
    </SettingsScene>
  )
}
