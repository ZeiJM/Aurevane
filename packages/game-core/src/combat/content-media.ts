/** Immutable descriptors are issued only by server finalization. URLs/labels are not identities. */
interface FinalizedMediaIdentity {
  readonly id: string
  readonly checksum: string
  readonly byteLength: number
}
export interface ContentImageCrop {
  readonly x: number
  readonly y: number
  readonly size: number
}
export interface FinalizedContentImage extends FinalizedMediaIdentity {
  readonly kind: 'image'
  readonly contentType: 'image/png'
  readonly width: number
  readonly height: number
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly crop: ContentImageCrop
}
export interface FinalizedContentAudio extends FinalizedMediaIdentity {
  readonly kind: 'audio'
  readonly contentType: 'audio/wav'
  readonly durationMs: number
  readonly channels: 1 | 2
  readonly sampleRate: 44100 | 48000
}
export type FinalizedContentMedia = FinalizedContentImage | FinalizedContentAudio
export const CONTENT_MEDIA_MAX_BYTES = 2 * 1024 * 1024
export const CONTENT_MEDIA_GUIDANCE =
  'Images: PNG, JPEG or WebP, up to 2 MiB and 4096 × 4096 pixels; a square crop is saved as PNG. Sound: PCM16 WAV, mono or stereo, 44.1 or 48 kHz, up to 10 seconds and 2 MiB. Other audio formats are unavailable.'
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max
export function isFinalizedContentMedia(value: unknown): value is FinalizedContentMedia {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(value.id) ||
    typeof value.checksum !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(value.checksum) ||
    !integer(value.byteLength, 1, CONTENT_MEDIA_MAX_BYTES)
  )
    return false
  const common = ['id', 'checksum', 'byteLength', 'kind', 'contentType']
  if (value.kind === 'image') {
    if (
      value.contentType !== 'image/png' ||
      !integer(value.width, 1, 4096) ||
      value.width !== value.height ||
      !integer(value.sourceWidth, 1, 4096) ||
      !integer(value.sourceHeight, 1, 4096) ||
      !record(value.crop)
    )
      return false
    const crop = value.crop
    return (
      Object.keys(value).every((key) =>
        [...common, 'width', 'height', 'sourceWidth', 'sourceHeight', 'crop'].includes(key),
      ) &&
      Object.keys(crop).length === 3 &&
      integer(crop.x, 0, 4095) &&
      integer(crop.y, 0, 4095) &&
      crop.size === value.width &&
      crop.x + value.width <= value.sourceWidth &&
      crop.y + value.width <= value.sourceHeight
    )
  }
  return (
    value.kind === 'audio' &&
    value.contentType === 'audio/wav' &&
    Object.keys(value).every((key) =>
      [...common, 'durationMs', 'channels', 'sampleRate'].includes(key),
    ) &&
    typeof value.durationMs === 'number' &&
    Number.isFinite(value.durationMs) &&
    value.durationMs > 0 &&
    value.durationMs <= 10000 &&
    [1, 2].includes(Number(value.channels)) &&
    [44100, 48000].includes(Number(value.sampleRate))
  )
}
export function contentMediaSource(value: FinalizedContentMedia, preview = false): string {
  return `${preview ? '/api/master/combat-content/media' : '/api/content-media'}/${value.id}`
}
export interface FinalizedContentMediaSlots {
  readonly artwork?: FinalizedContentImage
  readonly audio?: FinalizedContentAudio
}
export function finalizedContentMediaIssues(value: unknown): readonly string[] {
  if (!record(value)) return ['media']
  return (['artwork', 'audio'] as const).flatMap((slot) =>
    value[slot] === undefined ||
    (isFinalizedContentMedia(value[slot]) &&
      value[slot].kind === (slot === 'artwork' ? 'image' : 'audio'))
      ? []
      : [`media.${slot}`],
  )
}
/** Existing display contracts carry an opaque hook key; uploaded artwork retains exact identity. */
export function contentArtworkKey(media: {
  readonly iconKey?: string | null
  readonly artwork?: FinalizedContentImage
}): string | null {
  return media.artwork ? `content-media.${media.artwork.id}` : (media.iconKey ?? null)
}

/** Only opaque finalized identities can become local media routes. */
export function contentMediaKeySource(key: string | null | undefined): string | null {
  const match = /^content-media\.([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/u.exec(key ?? '')
  return match ? `/api/content-media/${match[1]}` : null
}
