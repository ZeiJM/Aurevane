export const SITE_MUSIC_UPDATED_EVENT = 'aurevane:site-music-updated'

export type SiteMusicSource = 'bundled' | 'upload' | 'url'

export interface SiteMusicTrack {
  label: string
  url: string
  source: SiteMusicSource
  loop: boolean
}

export interface SiteMusicRouteOverride {
  id: string
  label: string
  pathPrefix: string
  enabled: boolean
  track: SiteMusicTrack
}

export interface SiteMusicDraft {
  enabled: boolean
  defaultTrack: SiteMusicTrack
  routeOverrides: SiteMusicRouteOverride[]
}

export interface SiteMusicConfig extends SiteMusicDraft {
  revision: number
  updatedAt: string | null
}

export interface SiteMusicUploadMetadata {
  label: string
  extension: string
  mimeType: string
  size: number
}

export const SITE_MUSIC_MAX_UPLOAD_BYTES = 20 * 1024 * 1024

const SITE_MUSIC_UPLOAD_EXTENSIONS: Readonly<Record<string, string>> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
}

export const DEFAULT_SITE_MUSIC_TRACK: SiteMusicTrack = {
  label: 'Road to Aurevane',
  url: '/media/audio/music/road-to-aurevane.webm',
  source: 'bundled',
  loop: true,
}

export async function attemptSiteMusicPlayback(
  play: () => Promise<void>,
  hidden: boolean,
): Promise<boolean> {
  if (hidden) return false

  try {
    await play()
    return true
  } catch {
    return false
  }
}

export function createDefaultSiteMusicConfig(): SiteMusicConfig {
  return {
    enabled: true,
    defaultTrack: { ...DEFAULT_SITE_MUSIC_TRACK },
    routeOverrides: [],
    revision: 1,
    updatedAt: null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, field: string, maxLength: number): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    value.trim() !== value
  ) {
    throw new Error(`${field} must be a non-empty string of at most ${maxLength} characters.`)
  }
  return value
}

function uploadLabel(name: string): string {
  const withoutExtension = name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  return (withoutExtension || 'Uploaded track').slice(0, 80)
}

export function parseSiteMusicUploadMetadata(value: unknown): SiteMusicUploadMetadata {
  if (!isRecord(value)) throw new Error('file must be an object.')

  const name = readString(value.name, 'file.name', 255)
  if (!Number.isSafeInteger(value.size) || (value.size as number) < 1) {
    throw new Error('file.size must be a positive integer.')
  }
  if ((value.size as number) > SITE_MUSIC_MAX_UPLOAD_BYTES) {
    throw new Error('Audio uploads must be 20 MB or smaller.')
  }
  const mimeType = readString(value.type, 'file.type', 80)
  const extension = SITE_MUSIC_UPLOAD_EXTENSIONS[mimeType]
  if (!extension) {
    throw new Error('Use an MP3, M4A/AAC, OGG, WebM, or WAV audio file.')
  }

  return {
    label: uploadLabel(name),
    extension,
    mimeType,
    size: value.size as number,
  }
}

export function isAllowedSiteMusicUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) {
    return !value.includes('\\') && !value.includes('\u0000')
  }

  try {
    const parsed = new URL(value)
    return (
      parsed.protocol === 'https:' &&
      parsed.username.length === 0 &&
      parsed.password.length === 0 &&
      parsed.href.length <= 2048
    )
  } catch {
    return false
  }
}

function parseTrack(value: unknown, field: string): SiteMusicTrack {
  if (!isRecord(value)) throw new Error(`${field} must be an object.`)

  const label = readString(value.label, `${field}.label`, 80)
  const url = readString(value.url, `${field}.url`, 2048)
  if (!isAllowedSiteMusicUrl(url)) {
    throw new Error(`${field}.url must be a root-relative path or an HTTPS URL.`)
  }
  if (value.source !== 'bundled' && value.source !== 'upload' && value.source !== 'url') {
    throw new Error(`${field}.source is invalid.`)
  }
  if (typeof value.loop !== 'boolean') throw new Error(`${field}.loop must be a boolean.`)

  return { label, url, source: value.source, loop: value.loop }
}

export function normalizeSiteMusicPathPrefix(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    throw new Error('Page path prefixes must begin with a single slash.')
  }
  if (trimmed.includes('?') || trimmed.includes('#') || trimmed.includes('\\')) {
    throw new Error('Page path prefixes cannot contain a query, hash, or backslash.')
  }
  if (trimmed === '/') return '/'
  return trimmed.replace(/\/+$/, '')
}

export function parseSiteMusicDraft(value: unknown): SiteMusicDraft {
  if (!isRecord(value)) throw new Error('Music configuration must be an object.')
  if (typeof value.enabled !== 'boolean') throw new Error('enabled must be a boolean.')

  const defaultTrack = parseTrack(value.defaultTrack, 'defaultTrack')
  if (!Array.isArray(value.routeOverrides) || value.routeOverrides.length > 50) {
    throw new Error('routeOverrides must contain at most 50 entries.')
  }

  const ids = new Set<string>()
  const prefixes = new Set<string>()
  const routeOverrides = value.routeOverrides.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`routeOverrides[${index}] must be an object.`)
    const id = readString(entry.id, `routeOverrides[${index}].id`, 100)
    const label = readString(entry.label, `routeOverrides[${index}].label`, 80)
    const pathPrefix = normalizeSiteMusicPathPrefix(
      readString(entry.pathPrefix, `routeOverrides[${index}].pathPrefix`, 240),
    )
    if (typeof entry.enabled !== 'boolean') {
      throw new Error(`routeOverrides[${index}].enabled must be a boolean.`)
    }
    if (ids.has(id)) throw new Error(`Duplicate route override id: ${id}`)
    if (prefixes.has(pathPrefix)) throw new Error(`Duplicate page path prefix: ${pathPrefix}`)
    ids.add(id)
    prefixes.add(pathPrefix)

    return {
      id,
      label,
      pathPrefix,
      enabled: entry.enabled,
      track: parseTrack(entry.track, `routeOverrides[${index}].track`),
    }
  })

  return { enabled: value.enabled, defaultTrack, routeOverrides }
}

export function parseSiteMusicConfig(value: unknown): SiteMusicConfig {
  if (!isRecord(value)) throw new Error('Music configuration must be an object.')
  const draft = parseSiteMusicDraft(value)
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 1) {
    throw new Error('revision must be a positive integer.')
  }
  if (value.updatedAt !== null && typeof value.updatedAt !== 'string') {
    throw new Error('updatedAt must be a string or null.')
  }
  return {
    ...draft,
    revision: value.revision as number,
    updatedAt: value.updatedAt as string | null,
  }
}

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/'
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function resolveSiteMusicTrack(
  config: SiteMusicConfig,
  pathname: string,
): SiteMusicTrack | null {
  if (!config.enabled) return null

  const override = [...config.routeOverrides]
    .filter((entry) => matchesPathPrefix(pathname, entry.pathPrefix))
    .sort((left, right) => right.pathPrefix.length - left.pathPrefix.length)[0]

  if (!override) return config.defaultTrack
  return override.enabled ? override.track : null
}
