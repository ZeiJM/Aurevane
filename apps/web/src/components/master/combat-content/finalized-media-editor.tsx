'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  CONTENT_MEDIA_GUIDANCE,
  CONTENT_MEDIA_MAX_BYTES,
  contentMediaSource,
  isFinalizedContentMedia,
  type ContentImageCrop,
  type FinalizedContentMedia,
  type FinalizedContentMediaSlots,
} from '@aurevane/game-core/combat/content-media'
import styles from './combat-content-editor.module.css'
import { MasterHelp } from '../master-help'

/** Reusable for independent Skills and image-only containers. No draft points at a local preview. */
export function FinalizedMediaEditor({
  value,
  onChange,
  allowAudio = true,
  fallbackArtwork,
  showArtworkRemoval = true,
}: {
  value: FinalizedContentMediaSlots
  onChange(value: FinalizedContentMediaSlots): void
  allowAudio?: boolean
  fallbackArtwork?: string
  showArtworkRemoval?: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [crop, setCrop] = useState<ContentImageCrop>({ x: 0, y: 0, size: 1 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const latest = useRef({ value, onChange })
  useEffect(() => {
    latest.current = { value, onChange }
  }, [value, onChange])
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    // The callback creates only an illustrative local preview; finalization independently decodes.
    const image = new window.Image()
    image.onload = () => {
      const size = Math.min(image.naturalWidth, image.naturalHeight)
      setCrop({
        x: Math.floor((image.naturalWidth - size) / 2),
        y: Math.floor((image.naturalHeight - size) / 2),
        size,
      })
      setPreview(url)
    }
    image.onerror = () =>
      setError('This image could not be decoded. Choose a PNG, JPEG or WebP image.')
    if (file.type.startsWith('image/')) image.src = url
    else queueMicrotask(() => setPreview(url))
    return () => {
      image.onload = null
      image.onerror = null
      URL.revokeObjectURL(url)
    }
  }, [file])
  useEffect(() => {
    if (!preview || !file?.type.startsWith('image/')) return
    const image = new window.Image()
    image.onload = () => {
      const context = canvas.current?.getContext('2d')
      context?.clearRect(0, 0, 192, 192)
      if (crop.size > 0)
        context?.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, 192, 192)
    }
    image.src = preview
    return () => {
      image.onload = null
    }
  }, [preview, crop, file])
  function choose(media: FinalizedContentMedia) {
    const current = latest.current
    current.onChange({
      ...current.value,
      ...(media.kind === 'image' ? { artwork: media } : { audio: media }),
    })
  }
  async function upload() {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.set('file', file)
      if (file.type.startsWith('image/')) body.set('crop', JSON.stringify(crop))
      const response = await fetch('/api/master/combat-content/media', { method: 'POST', body })
      const result = await response.json()
      if (!response.ok)
        throw new Error(
          result.error?.message ??
            result.message ??
            'Upload failed. Check the file format and try again.',
        )
      if (!isFinalizedContentMedia(result.media) || (!allowAudio && result.media.kind === 'audio'))
        throw new Error('The server did not return a supported finalized asset.')
      choose(result.media)
      setFile(null)
      setPreview('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <fieldset
      className={styles.mediaUpload}
      data-media-editor
      aria-label={allowAudio ? 'Artwork and sound' : 'Artwork'}
      disabled={busy}
    >
      <div className={styles.mediaHeading}>
        <strong>{allowAudio ? 'Artwork and sound' : 'Artwork'}</strong>
        <MasterHelp label="Media uploads">{CONTENT_MEDIA_GUIDANCE}</MasterHelp>
      </div>
      <div className={styles.mediaPreviewGrid}>
        {!value.artwork && fallbackArtwork ? (
          <div>
            <p>Current artwork</p>
            <Image
              src={fallbackArtwork}
              alt="Current artwork"
              width={192}
              height={192}
              unoptimized
            />
          </div>
        ) : null}
        {value.artwork && (
          <div>
            <p>Current artwork</p>
            <Image
              src={contentMediaSource(value.artwork, true)}
              onError={() =>
                setError(
                  'The finalized artwork preview is unavailable. Check your access or try again.',
                )
              }
              alt="Finalized artwork crop"
              width={192}
              height={192}
              unoptimized
            />
            {showArtworkRemoval && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...value, artwork: undefined })
                  }}
                >
                  Remove uploaded artwork
                </button>
              </>
            )}
          </div>
        )}
        {file?.type.startsWith('image/') && (
          <div>
            <p>New artwork</p>
            <canvas ref={canvas} width={192} height={192} aria-label="Actual crop preview" />
          </div>
        )}
      </div>
      <p className={styles.mediaHint}>Images are automatically centered and cropped to a square.</p>
      <div className={styles.mediaUploadControls}>
        <label className={styles.field}>
          <span>Upload from computer</span>
          <input
            type="file"
            aria-label="Upload content media"
            accept={`image/png,image/jpeg,image/webp${allowAudio ? ',audio/wav,audio/x-wav' : ''}`}
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0] ?? null
              event.currentTarget.value = ''
              setError('')
              setPreview('')
              if (selected && !allowAudio && !selected.type.startsWith('image/')) {
                setError('This category supports images only; audio is unavailable.')
                setFile(null)
              } else if (selected && selected.size > CONTENT_MEDIA_MAX_BYTES) {
                setError('Choose a file no larger than 2 MiB.')
                setFile(null)
              } else setFile(selected)
            }}
          />
        </label>
        <button
          type="button"
          disabled={!file || busy || (file.type.startsWith('image/') && !preview)}
          onClick={() => void upload()}
        >
          {busy ? 'Uploading…' : 'Upload file'}
        </button>
      </div>
      {file && <p className={styles.mediaHint}>Selected: {file.name}</p>}
      {file && !file.type.startsWith('image/') && preview && (
        <div className={styles.mediaSound}>
          <p>New sound</p>
          <audio
            controls
            onError={() =>
              setError(
                'This sound could not be played. Use PCM16 WAV, mono or stereo, at 44.1 or 48 kHz.',
              )
            }
            src={preview}
            aria-label="Selected sound preview"
          />
        </div>
      )}
      <p className={styles.mediaHint}>
        Upload file adds media to your edits. Use Commit Now to save it.
      </p>
      {value.audio && (
        <div className={styles.mediaSound}>
          <p>Current uploaded sound</p>
          <audio
            controls
            preload="none"
            src={contentMediaSource(value.audio, true)}
            onError={() =>
              setError(
                'The finalized sound preview is unavailable. Check your access or try again.',
              )
            }
            aria-label="Finalized sound preview"
          />
          <button
            type="button"
            onClick={() => {
              onChange({ ...value, audio: undefined })
            }}
          >
            Remove uploaded sound
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  )
}
