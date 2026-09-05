export type LastSeenSortOrder = 'recent' | 'oldest'

export function readableIdentity(value: string | null): string | null {
  if (!value) return null
  return value
    .replace(/^starter[.:_-]?/i, '')
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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
