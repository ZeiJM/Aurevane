export type LastSeenSortOrder = 'recent' | 'oldest'
export type DirectorySortOrder =
  LastSeenSortOrder | 'alphabetical' | 'level-desc' | 'level-asc' | 'exp-desc' | 'exp-asc'

interface DirectoryCharacter {
  characterId: string
  name: string
  level: number
  xp: number | null
  lastSeenAt: string | null
}

export function compareDirectoryCharacters(
  left: DirectoryCharacter,
  right: DirectoryCharacter,
  order: DirectorySortOrder,
): number {
  if (order === 'level-desc' || order === 'level-asc') {
    const difference = order === 'level-desc' ? right.level - left.level : left.level - right.level
    if (difference !== 0) return difference
  }
  if (order === 'exp-desc' || order === 'exp-asc') {
    if (left.xp === null && right.xp !== null) return 1
    if (right.xp === null && left.xp !== null) return -1
    if (left.xp !== null && right.xp !== null) {
      const difference = order === 'exp-desc' ? right.xp - left.xp : left.xp - right.xp
      if (difference !== 0) return difference
    }
  }
  if (order !== 'alphabetical') {
    const difference = compareLastSeenAt(
      left.lastSeenAt,
      right.lastSeenAt,
      order === 'oldest' ? 'oldest' : 'recent',
    )
    if (difference !== 0) return difference
  }
  const nameBucket = (name: string) =>
    /^[A-Za-z]/.test(name.trim()) ? 0 : /^\d/.test(name.trim()) ? 1 : 2
  return (
    nameBucket(left.name) - nameBucket(right.name) ||
    left.name.localeCompare(right.name, 'en', { sensitivity: 'base', numeric: true }) ||
    left.characterId.localeCompare(right.characterId)
  )
}

export function readableIdentity(value: string | null): string | null {
  if (!value) return null
  return value
    .replace(/^starter[.:_-]?/i, '')
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function readableDisciplinePair(
  primaryDisciplineId: string | null,
  secondaryDisciplineId: string | null,
): string | null {
  const primary = readableIdentity(primaryDisciplineId)
  const secondary = readableIdentity(secondaryDisciplineId)
  if (primary && secondary) return `${primary} | ${secondary}`
  return primary ?? secondary
}

function lastSeenMillis(value: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatLastSeenAt(lastSeenAt: string | null, nowMs: number): string {
  const seenMs = lastSeenMillis(lastSeenAt)
  if (seenMs === null) return 'Never seen'

  const minutes = Math.max(0, Math.floor((nowMs - seenMs) / 60_000))
  return `Last seen ${minutes.toLocaleString('en-US')} min ago`
}

export function compareLastSeenAt(
  left: string | null,
  right: string | null,
  order: LastSeenSortOrder,
): number {
  const leftMs = lastSeenMillis(left)
  const rightMs = lastSeenMillis(right)

  // Characters with no recorded heartbeat always belong at the end of the roster.
  if (leftMs === null && rightMs === null) return 0
  if (leftMs === null) return 1
  if (rightMs === null) return -1
  return order === 'recent' ? rightMs - leftMs : leftMs - rightMs
}
