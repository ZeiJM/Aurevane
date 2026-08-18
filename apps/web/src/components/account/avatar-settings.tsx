'use client'

import { useState } from 'react'

import styles from './avatar-settings.module.css'

export function AvatarSettings({ initialAvatarUrl }: { initialAvatarUrl: string | null }) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? '')
  const [savedAvatarUrl, setSavedAvatarUrl] = useState(initialAvatarUrl)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)

  async function save() {
    if (busy) return
    setBusy(true)
    setMessage(null)
    setPreviewFailed(false)
    try {
      const response = await fetch('/api/account/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl }),
      })
      const payload = (await response.json()) as {
        avatarUrl?: string
        error?: { message?: string }
      }
      if (!response.ok || !payload.avatarUrl) {
        setMessage(payload.error?.message ?? 'Avatar could not be saved.')
        return
      }
      setAvatarUrl(payload.avatarUrl)
      setSavedAvatarUrl(payload.avatarUrl)
      setMessage('Avatar saved. It will appear throughout your authenticated game UI.')
    } catch {
      setMessage('Avatar settings could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/account/avatar', { method: 'DELETE' })
      if (!response.ok) throw new Error('remove failed')
      setAvatarUrl('')
      setSavedAvatarUrl(null)
      setPreviewFailed(false)
      setMessage('Avatar removed. AUREVANE will use the default character presentation again.')
    } catch {
      setMessage('Avatar could not be removed.')
    } finally {
      setBusy(false)
    }
  }

  const previewUrl = avatarUrl.trim()

  return (
    <section className={styles.layout}>
      <div className={styles.preview}>
        <div className={styles.previewFrame}>
          {previewUrl && !previewFailed ? (
            // A normal img intentionally preserves remote GIF animation and works with arbitrary HTTPS hosts.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Avatar preview"
              onError={() => setPreviewFailed(true)}
              onLoad={() => setPreviewFailed(false)}
            />
          ) : (
            <span aria-hidden="true">A</span>
          )}
        </div>
        <div>
          <strong>{previewFailed ? 'Image could not be loaded' : 'Live preview'}</strong>
          <p>Static images and animated GIFs are supported. The image is cropped to fit each UI context.</p>
        </div>
      </div>

      <div className={styles.controls}>
        <label>
          <span>Direct image URL</span>
          <input
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com/avatar.gif"
            value={avatarUrl}
            onChange={(event) => {
              setAvatarUrl(event.target.value)
              setPreviewFailed(false)
              setMessage(null)
            }}
          />
          <small>HTTPS only. Use a direct image URL that your browser can load publicly.</small>
        </label>

        <div className={styles.actions}>
          <button type="button" disabled={busy || !avatarUrl.trim()} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save Avatar'}
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy || !savedAvatarUrl}
            onClick={() => void remove()}
          >
            Remove
          </button>
        </div>

        {message ? <p className={styles.message} role="status">{message}</p> : null}
      </div>
    </section>
  )
}
