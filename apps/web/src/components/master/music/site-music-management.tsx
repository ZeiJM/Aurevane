'use client'

import { GameButton } from '@aurevane/ui'
import { useMemo, useState, useEffect, useRef } from 'react'

import {
  SITE_MUSIC_UPDATED_EVENT,
  SITE_MUSIC_PREVIEW_EVENT,
  matchingSiteMusicOverride,
  siteMusicOverrideMode,
  resolveSiteMusicTrack,
  parseSiteMusicDraft,
  parseSiteMusicUploadMetadata,
  type SiteMusicMode,
  type SiteMusicConfig,
  type SiteMusicRouteOverride,
  type SiteMusicTrack,
} from '@/lib/site-music'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { MasterHelp } from '@/components/master/master-help'

import { SITE_MUSIC_PAGES } from '@/lib/site-music-pages'
import styles from './site-music-management.module.css'

interface SiteMusicManagementProps {
  initialConfig: SiteMusicConfig
}

type UploadTarget = { kind: 'default' } | { kind: 'override'; id: string } | { kind: 'library' }

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
    songLibrary: parseSiteMusicDraft(config).songLibrary?.map((track) => ({ ...track })),
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
  const [previewError, setPreviewError] = useState<{ url: string; message: string } | null>(null)
  const previewing = useRef(false)
  function previewState(playing: boolean) {
    previewing.current = playing
    window.dispatchEvent(new CustomEvent(SITE_MUSIC_PREVIEW_EVENT, { detail: playing }))
  }
  useEffect(
    () => () => {
      if (previewing.current)
        window.dispatchEvent(new CustomEvent(SITE_MUSIC_PREVIEW_EVENT, { detail: false }))
    },
    [track.url],
  )
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

      <label className={styles.uploadButton}>
        <span>{uploading ? 'Uploading…' : 'Upload from PC'}</span>
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
          key={track.url}
          className={styles.preview}
          aria-label="Track preview"
          controls
          loop
          preload="metadata"
          src={track.url}
          onPlay={() => {
            setPreviewError(null)
            previewState(true)
          }}
          onPause={() => previewState(false)}
          onEnded={() => previewState(false)}
          onError={() => {
            previewState(false)
            setPreviewError({
              url: track.url,
              message:
                'This audio could not be played. Check the direct media URL, file format and access permissions.',
            })
          }}
        >
          Your browser cannot preview this audio source.
        </audio>
      ) : null}
      {previewError?.url === track.url ? <p role="alert">{previewError.message}</p> : null}
    </div>
  )
}

export function SiteMusicManagement({ initialConfig }: SiteMusicManagementProps) {
  const [config, setConfig] = useState(() => cloneConfig(initialConfig))
  const [savedConfig, setSavedConfig] = useState(() => cloneConfig(initialConfig))
  const [saving, setSaving] = useState(false)
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState('global')
  const [search, setSearch] = useState('')
  const [songSearch, setSongSearch] = useState('')
  const [librarySong, setLibrarySong] = useState<{
    originalUrl: string | null
    track: SiteMusicTrack
  } | null>(null)
  const pages = [
    ...SITE_MUSIC_PAGES,
    ...config.routeOverrides
      .filter((entry) => !SITE_MUSIC_PAGES.some((page) => page.path === entry.pathPrefix))
      .map((entry) => ({ path: entry.pathPrefix, label: entry.label })),
  ]
  const selectedPage = pages.find((page) => page.path === selectedPath)
  const selectedOverride = config.routeOverrides.find((entry) => entry.pathPrefix === selectedPath)
  const effectiveTrack = resolveSiteMusicTrack(config, selectedPath)
  const inherited = matchingSiteMusicOverride(config, selectedPath)
  const mode = selectedOverride ? siteMusicOverrideMode(selectedOverride) : 'inherited'
  function chooseMode(nextMode: SiteMusicMode) {
    if (!selectedPage) return
    setConfig((current) => {
      const existing = current.routeOverrides.find((entry) => entry.pathPrefix === selectedPath)
      const entry: SiteMusicRouteOverride = {
        id: existing?.id ?? crypto.randomUUID(),
        label: existing?.label ?? selectedPage.label,
        pathPrefix: selectedPath,
        mode: nextMode,
        enabled: nextMode !== 'silent',
        track: existing?.track ?? {
          ...(resolveSiteMusicTrack(current, selectedPath) ?? current.defaultTrack),
        },
      }
      return {
        ...current,
        routeOverrides: existing
          ? current.routeOverrides.map((item) => (item.id === existing.id ? entry : item))
          : [...current.routeOverrides, entry],
      }
    })
  }
  function pageStatus(path: string) {
    const matching = matchingSiteMusicOverride(config, path)
    const track = resolveSiteMusicTrack(config, path)
    const origin =
      matching?.pathPrefix === path
        ? siteMusicOverrideMode(matching) === 'global'
          ? 'Global'
          : 'Page'
        : matching
          ? `Inherited from ${matching.pathPrefix}`
          : 'Global'
    return `${origin} · ${track?.label ?? 'No Music'}`
  }
  const dirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(savedConfig),
    [config, savedConfig],
  )

  function updateDefaultTrack(track: SiteMusicTrack) {
    setConfig((current) => ({
      ...current,
      defaultTrack: track,
    }))
  }

  function updateOverride(
    id: string,
    update: (entry: SiteMusicRouteOverride) => SiteMusicRouteOverride,
  ) {
    setConfig((current) => {
      const routeOverrides = current.routeOverrides.map((entry) =>
        entry.id === id ? update(entry) : entry,
      )
      return {
        ...current,
        routeOverrides,
      }
    })
  }

  function includeSong(songs: SiteMusicTrack[], track: SiteMusicTrack) {
    return songs.some((song) => song.url === track.url) ? songs : [...songs, { ...track }]
  }

  function assignSong(track: SiteMusicTrack) {
    if (selectedPath === 'global') {
      updateDefaultTrack(track)
      setConfig((current) => ({ ...current, enabled: true }))
    } else if (selectedPage) {
      chooseMode('custom')
      setConfig((current) => ({
        ...current,
        routeOverrides: current.routeOverrides.map((entry) =>
          entry.pathPrefix === selectedPath ? { ...entry, track: { ...track } } : entry,
        ),
      }))
    }
    setLibrarySong(null)
  }

  function saveLibrarySong() {
    if (!librarySong) return
    try {
      const { track, originalUrl } = librarySong
      const songs = config.songLibrary ?? []
      if (songs.some((song) => song.url === track.url && song.url !== originalUrl))
        throw new Error('This audio URL is already in the library.')
      const next = {
        ...config,
        songLibrary:
          originalUrl === null
            ? [...songs, track]
            : songs.map((song) => (song.url === originalUrl ? track : song)),
        defaultTrack: config.defaultTrack.url === originalUrl ? track : config.defaultTrack,
        routeOverrides: config.routeOverrides.map((entry) =>
          entry.track.url === originalUrl ? { ...entry, track } : entry,
        ),
      }
      parseSiteMusicDraft(next)
      setConfig(next)
      setLibrarySong({ originalUrl: track.url, track })
      setMessage('Song added to your changes. Save Changes to keep it.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The song could not be added.')
    }
  }

  function deleteLibrarySong() {
    if (!librarySong?.originalUrl) return
    const url = librarySong.originalUrl
    if (
      config.defaultTrack.url === url ||
      config.routeOverrides.some((entry) => entry.track.url === url)
    ) {
      setMessage(
        'This song is still assigned. Replace its global or page selections before deleting it, including retained silent selections.',
      )
      return
    }
    setConfig((current) => ({
      ...current,
      songLibrary: current.songLibrary?.filter((song) => song.url !== url),
    }))
    setLibrarySong(null)
    setMessage('Song removed from your changes. Save Changes to keep it.')
  }

  async function upload(file: File, target: UploadTarget) {
    const targetKey = target.kind === 'override' ? target.id : target.kind
    setUploadingTarget(targetKey)
    setMessage(null)
    try {
      parseSiteMusicUploadMetadata({ name: file.name, size: file.size, type: file.type })
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

      if (target.kind === 'library') {
        setLibrarySong({
          originalUrl: librarySong?.originalUrl ?? null,
          track: payload.upload.track,
        })
      } else if (target.kind === 'default') {
        updateDefaultTrack(payload.upload.track)
      } else {
        updateOverride(target.id, (entry) => ({ ...entry, track: payload.upload.track }))
      }
      setMessage(
        `${payload.upload.track.label} uploaded. ${target.kind === 'library' ? 'Add or update the library song, then Save Changes.' : 'Save Changes to publish it.'}`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The audio file could not be uploaded.')
    } finally {
      setUploadingTarget(null)
    }
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      // Keep unfinished URL keystrokes out of the reusable library. Only the
      // completed selections join it at the save boundary.
      const songLibrary = [
        config.defaultTrack,
        ...config.routeOverrides.map((entry) => entry.track),
      ].reduce(includeSong, config.songLibrary ?? [])
      parseSiteMusicDraft({ ...config, songLibrary })
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
            songLibrary,
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
          <h2 id="site-music-heading">Site Music</h2>
          <MasterHelp label="Music guidance">
            <p>
              Add named songs to the library for later, then choose one for Global Music or a page.
              Save Changes keeps the library and page selections together.
            </p>
            <p>
              Use Global bypasses broader page rules. Remove a page rule to inherit them. No Music
              retains the previous selection for reuse.
            </p>
            <p>
              Upload MP3, M4A/AAC, OGG, WebM or WAV audio up to 20 MB. All background music loops.
              Preview a song before saving.
            </p>
            <p>
              Updating a library song also replaces its global and page selections. Replace all
              selections before deleting a song. Deleting a library entry retains its stored audio
              file.
            </p>
          </MasterHelp>
        </div>
        <GameButton
          type="button"
          onClick={save}
          disabled={saving || !dirty || uploadingTarget !== null}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </GameButton>
      </div>
      {message ? (
        <p className={styles.notice} role="status">
          {message}
        </p>
      ) : null}
      <div className={styles.musicWorkspace}>
        <nav className={styles.trackLibrary} aria-label="Page music">
          <button
            type="button"
            aria-pressed={selectedPath === 'global'}
            onClick={() => {
              setSelectedPath('global')
              setLibrarySong(null)
            }}
          >
            <strong>Global Music</strong>
            <small>{config.enabled ? config.defaultTrack.label : 'No Music'}</small>
          </button>
          <label>
            Search pages
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
          </label>
          <div className={styles.pageList}>
            {pages
              .filter((page) =>
                `${page.label} ${page.path}`.toLowerCase().includes(search.toLowerCase()),
              )
              .map((page) => (
                <button
                  type="button"
                  key={page.path}
                  aria-pressed={selectedPath === page.path}
                  onClick={() => {
                    setSelectedPath(page.path)
                    setLibrarySong(null)
                  }}
                >
                  <strong>{page.label}</strong>
                  <small>
                    {page.path} · {pageStatus(page.path)}
                  </small>
                </button>
              ))}
          </div>
        </nav>
        <nav className={styles.songLibrary} aria-label="Song library">
          <h3>Song library</h3>
          <button
            type="button"
            onClick={() =>
              setLibrarySong({
                originalUrl: null,
                track: { label: '', url: '', source: 'url', loop: true },
              })
            }
          >
            Add song
          </button>
          <label>
            Search songs
            <input
              type="search"
              value={songSearch}
              onChange={(event) => setSongSearch(event.currentTarget.value)}
            />
          </label>
          <div className={styles.songList}>
            {(config.songLibrary ?? [])
              .filter((song) => song.label.toLowerCase().includes(songSearch.toLowerCase()))
              .map((song) => (
                <button
                  key={song.url}
                  type="button"
                  aria-pressed={librarySong?.originalUrl === song.url}
                  onClick={() => setLibrarySong({ originalUrl: song.url, track: { ...song } })}
                >
                  <strong>{song.label}</strong>
                  <small>{song.source}</small>
                </button>
              ))}
          </div>
        </nav>
        <div className={styles.trackDetail}>
          {librarySong ? (
            <article className={styles.card}>
              <h3>{librarySong.originalUrl ? 'Library song' : 'New song'}</h3>
              <TrackEditor
                key={librarySong.originalUrl ?? 'new'}
                track={librarySong.track}
                onChange={(track) =>
                  setLibrarySong((current) => (current ? { ...current, track } : current))
                }
                onUpload={(file) => void upload(file, { kind: 'library' })}
                uploading={uploadingTarget === 'library'}
              />
              <div className={styles.actions}>
                <button type="button" disabled={uploadingTarget !== null} onClick={saveLibrarySong}>
                  {librarySong.originalUrl ? 'Update song' : 'Add to library'}
                </button>
                {librarySong.originalUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        assignSong(
                          (config.songLibrary ?? []).find(
                            (song) => song.url === librarySong.originalUrl,
                          )!,
                        )
                      }
                    >{`Use for ${selectedPage?.label ?? 'Global Music'}`}</button>
                    <button type="button" onClick={deleteLibrarySong}>
                      Delete song
                    </button>
                  </>
                ) : null}
                <button type="button" onClick={() => setLibrarySong(null)}>
                  Back to assignment
                </button>
              </div>
            </article>
          ) : selectedPath === 'global' ? (
            <article className={styles.card}>
              <h3>Global Music</h3>
              <label>
                Global selection
                <select
                  value={config.enabled ? 'custom' : 'silent'}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      enabled: event.currentTarget.value === 'custom',
                    }))
                  }
                >
                  <option value="custom">Custom Track</option>
                  <option value="silent">No Music</option>
                </select>
              </label>
              {config.enabled ? (
                <>
                  <label>
                    Library song
                    <select
                      value={config.defaultTrack.url}
                      onChange={(event) =>
                        assignSong(
                          config.songLibrary!.find(
                            (song) => song.url === event.currentTarget.value,
                          )!,
                        )
                      }
                    >
                      {config.songLibrary?.map((song) => (
                        <option key={song.url} value={song.url}>
                          {song.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TrackEditor
                    key="global"
                    track={config.defaultTrack}
                    onChange={updateDefaultTrack}
                    onUpload={(file) => void upload(file, { kind: 'default' })}
                    uploading={uploadingTarget === 'default'}
                  />
                  <button
                    type="button"
                    onClick={() => setConfig((current) => ({ ...current, enabled: false }))}
                  >
                    Remove global track
                  </button>
                </>
              ) : (
                <p>Global Music is silent. The previous track is retained for reuse.</p>
              )}
            </article>
          ) : selectedPage ? (
            <article className={styles.card}>
              <h3>{selectedPage.label}</h3>
              <label>
                Page music
                <select
                  value={mode}
                  onChange={(event) => chooseMode(event.currentTarget.value as SiteMusicMode)}
                >
                  {mode === 'inherited' ? (
                    <option value="inherited" disabled>
                      Inherited · {inherited?.label ?? 'Global Music'}
                    </option>
                  ) : null}
                  <option value="global">Use Global</option>
                  <option value="custom">Custom Track</option>
                  <option value="silent">No Music</option>
                </select>
              </label>
              <p>Effective music: {effectiveTrack?.label ?? 'No Music'}.</p>
              {mode === 'inherited' && inherited ? (
                <p>
                  Existing coverage from {inherited.pathPrefix} remains until you choose a page
                  setting.
                </p>
              ) : null}
              <button type="button" onClick={() => chooseMode('global')}>
                Reset to Global
              </button>
              {selectedOverride && mode === 'custom' ? (
                <>
                  <label>
                    Library song
                    <select
                      value={selectedOverride.track.url}
                      onChange={(event) =>
                        assignSong(
                          config.songLibrary!.find(
                            (song) => song.url === event.currentTarget.value,
                          )!,
                        )
                      }
                    >
                      {config.songLibrary?.map((song) => (
                        <option key={song.url} value={song.url}>
                          {song.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TrackEditor
                    key={selectedOverride.id}
                    track={selectedOverride.track}
                    onChange={(track) =>
                      updateOverride(selectedOverride.id, (entry) => ({ ...entry, track }))
                    }
                    onUpload={(file) =>
                      void upload(file, { kind: 'override', id: selectedOverride.id })
                    }
                    uploading={uploadingTarget === selectedOverride.id}
                  />
                  <button type="button" onClick={() => chooseMode('silent')}>
                    Remove page track
                  </button>
                </>
              ) : null}
              {selectedOverride ? (
                <button
                  type="button"
                  onClick={() =>
                    setConfig((current) => ({
                      ...current,
                      routeOverrides: current.routeOverrides.filter(
                        (entry) => entry.id !== selectedOverride.id,
                      ),
                    }))
                  }
                >
                  Remove page rule and inherit
                </button>
              ) : null}
            </article>
          ) : null}
        </div>
      </div>
    </section>
  )
}
