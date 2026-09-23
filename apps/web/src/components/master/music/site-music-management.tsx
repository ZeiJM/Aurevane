'use client'

import { GameButton } from '@aurevane/ui'
import { useMemo, useState } from 'react'

import {
  SITE_MUSIC_UPDATED_EVENT,
  type SiteMusicConfig,
  type SiteMusicRouteOverride,
  type SiteMusicTrack,
} from '@/lib/site-music'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

import styles from './site-music-management.module.css'

interface SiteMusicManagementProps {
  initialConfig: SiteMusicConfig
}

type UploadTarget = { kind: 'default' } | { kind: 'override'; id: string }

type ApiError = {
  error?: {
    message?: string
  }
}

interface SiteMusicUploadTicket {
  bucket: string
  path: string
  token: string
  track: SiteMusicTrack
}

function cloneConfig(config: SiteMusicConfig): SiteMusicConfig {
  return {
    ...config,
    defaultTrack: { ...config.defaultTrack },
    routeOverrides: config.routeOverrides.map((entry) => ({
      ...entry,
      track: { ...entry.track },
    })),
  }
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiError
    return payload.error?.message ?? `Request failed with status ${response.status}.`
  } catch {
    return `Request failed with status ${response.status}.`
  }
}

function TrackEditor({
  track,
  onChange,
  onUpload,
  uploading,
}: {
  track: SiteMusicTrack
  onChange(track: SiteMusicTrack): void
  onUpload(file: File): void
  uploading: boolean
}) {
  return (
    <div className={styles.trackEditor}>
      <label>
        <span>Track name</span>
        <input
          value={track.label}
          maxLength={80}
          onChange={(event) => onChange({ ...track, label: event.currentTarget.value })}
        />
      </label>

      <label className={styles.wideField}>
        <span>Audio URL</span>
        <input
          value={track.url}
          inputMode="url"
          placeholder="https://… or /media/audio/…"
          onChange={(event) =>
            onChange({ ...track, url: event.currentTarget.value, source: 'url' })
          }
        />
      </label>

      <label className={styles.loopToggle}>
        <input
          type="checkbox"
          checked={track.loop}
          onChange={(event) => onChange({ ...track, loop: event.currentTarget.checked })}
        />
        <span>Loop continuously</span>
      </label>

      <label className={styles.uploadButton}>
        <span>{uploading ? 'Uploading…' : 'Upload audio file'}</span>
        <input
          type="file"
          accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/webm,audio/wav,audio/x-wav"
          disabled={uploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) onUpload(file)
            event.currentTarget.value = ''
          }}
        />
      </label>

      {track.url ? (
        <audio
          className={styles.preview}
          controls
          loop={track.loop}
          preload="metadata"
          src={track.url}
        >
          Your browser cannot preview this audio source.
        </audio>
      ) : null}
    </div>
  )
}

export function SiteMusicManagement({ initialConfig }: SiteMusicManagementProps) {
  const [config, setConfig] = useState(() => cloneConfig(initialConfig))
  const [savedConfig, setSavedConfig] = useState(() => cloneConfig(initialConfig))
  const [saving, setSaving] = useState(false)
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const dirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(savedConfig),
    [config, savedConfig],
  )

  function updateDefaultTrack(track: SiteMusicTrack) {
    setConfig((current) => ({ ...current, defaultTrack: track }))
  }

  function updateOverride(
    id: string,
    update: (entry: SiteMusicRouteOverride) => SiteMusicRouteOverride,
  ) {
    setConfig((current) => ({
      ...current,
      routeOverrides: current.routeOverrides.map((entry) =>
        entry.id === id ? update(entry) : entry,
      ),
    }))
  }

  async function upload(file: File, target: UploadTarget) {
    const targetKey = target.kind === 'default' ? 'default' : target.id
    setUploadingTarget(targetKey)
    setMessage(null)
    try {
      const response = await fetch('/api/master/site-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'create-upload',
          file: {
            name: file.name,
            size: file.size,
            type: file.type,
          },
        }),
      })
      if (!response.ok) throw new Error(await responseMessage(response))

      const payload = (await response.json()) as { upload: SiteMusicUploadTicket }
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.storage
        .from(payload.upload.bucket)
        .uploadToSignedUrl(payload.upload.path, payload.upload.token, file, {
          cacheControl: '31536000',
          contentType: file.type,
          upsert: false,
        })
      if (error) throw new Error(error.message)

      if (target.kind === 'default') {
        updateDefaultTrack(payload.upload.track)
      } else {
        updateOverride(target.id, (entry) => ({ ...entry, track: payload.upload.track }))
      }
      setMessage(`${payload.upload.track.label} uploaded. Save changes to publish it.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The audio file could not be uploaded.')
    } finally {
      setUploadingTarget(null)
    }
  }

  function addOverride() {
    const id = crypto.randomUUID()
    setConfig((current) => ({
      ...current,
      routeOverrides: [
        ...current.routeOverrides,
        {
          id,
          label: 'New page music',
          pathPrefix: `/game/page-${current.routeOverrides.length + 1}`,
          enabled: true,
          track: { ...current.defaultTrack },
        },
      ],
    }))
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/master/site-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'save',
          expectedRevision: config.revision,
          config: {
            enabled: config.enabled,
            defaultTrack: config.defaultTrack,
            routeOverrides: config.routeOverrides,
          },
        }),
      })
      if (!response.ok) throw new Error(await responseMessage(response))
      const payload = (await response.json()) as { config: SiteMusicConfig }
      const publishedConfig = cloneConfig(payload.config)
      setConfig(publishedConfig)
      setSavedConfig(cloneConfig(payload.config))
      window.dispatchEvent(new CustomEvent(SITE_MUSIC_UPDATED_EVENT, { detail: payload.config }))
      setMessage('Site music published. Open pages will use the new rules immediately.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Site music changes could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.root} aria-labelledby="site-music-heading">
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>Global soundtrack</p>
          <h2 id="site-music-heading">Site Music</h2>
          <p>
            Set the default soundtrack for every page, then add more-specific rules for individual
            areas. The longest matching page path wins.
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <span className={styles.revision}>Revision {config.revision}</span>
          <GameButton type="button" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Publishing…' : 'Publish music'}
          </GameButton>
        </div>
      </div>

      {message ? <p className={styles.notice}>{message}</p> : null}

      <article className={styles.card}>
        <div className={styles.cardHeading}>
          <div>
            <h3>Default site track</h3>
            <p>Used on signup, login, character creation, and every page without an override.</p>
          </div>
          <label className={styles.masterToggle}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(event) =>
                setConfig((current) => ({ ...current, enabled: event.currentTarget.checked }))
              }
            />
            <span>{config.enabled ? 'Music enabled' : 'Music disabled'}</span>
          </label>
        </div>
        <TrackEditor
          track={config.defaultTrack}
          onChange={updateDefaultTrack}
          onUpload={(file) => void upload(file, { kind: 'default' })}
          uploading={uploadingTarget === 'default'}
        />
      </article>

      <div className={styles.rulesHeading}>
        <div>
          <p className={styles.eyebrow}>Route-specific soundtrack</p>
          <h3>Page overrides</h3>
          <p>
            Examples: <code>/</code>, <code>/game/create</code>, or <code>/game/battle</code>.
            Disable a rule to make that area silent.
          </p>
        </div>
        <GameButton type="button" variant="quiet" onClick={addOverride}>
          Add page rule
        </GameButton>
      </div>

      <div className={styles.rules}>
        {config.routeOverrides.length === 0 ? (
          <div className={styles.empty}>No page overrides. The default track plays everywhere.</div>
        ) : null}
        {config.routeOverrides.map((entry, index) => (
          <article className={styles.card} key={entry.id}>
            <div className={styles.ruleTopline}>
              <span className={styles.ruleNumber}>{String(index + 1).padStart(2, '0')}</span>
              <label>
                <span>Rule name</span>
                <input
                  value={entry.label}
                  maxLength={80}
                  onChange={(event) =>
                    updateOverride(entry.id, (current) => ({
                      ...current,
                      label: event.currentTarget.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Page path prefix</span>
                <input
                  value={entry.pathPrefix}
                  placeholder="/game/battle"
                  onChange={(event) =>
                    updateOverride(entry.id, (current) => ({
                      ...current,
                      pathPrefix: event.currentTarget.value,
                    }))
                  }
                />
              </label>
              <label className={styles.ruleToggle}>
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={(event) =>
                    updateOverride(entry.id, (current) => ({
                      ...current,
                      enabled: event.currentTarget.checked,
                    }))
                  }
                />
                <span>{entry.enabled ? 'Play track' : 'Silent section'}</span>
              </label>
              <button
                className={styles.removeButton}
                type="button"
                onClick={() =>
                  setConfig((current) => ({
                    ...current,
                    routeOverrides: current.routeOverrides.filter(
                      (candidate) => candidate.id !== entry.id,
                    ),
                  }))
                }
              >
                Remove
              </button>
            </div>
            <TrackEditor
              track={entry.track}
              onChange={(track) => updateOverride(entry.id, (current) => ({ ...current, track }))}
              onUpload={(file) => void upload(file, { kind: 'override', id: entry.id })}
              uploading={uploadingTarget === entry.id}
            />
          </article>
        ))}
      </div>
    </section>
  )
}
