export interface AccountBanStatus {
  active: boolean
  permanent: boolean
  expiresAt: string | null
  reason: string | null
  serverTime: string
}
export function parseAccountBanStatus(value: unknown): AccountBanStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid account status')
  const row = value as Record<string, unknown>
  const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
  if (
    typeof row.active !== 'boolean' ||
    typeof row.permanent !== 'boolean' ||
    !date(row.serverTime) ||
    (row.expiresAt !== null && !date(row.expiresAt)) ||
    (row.reason !== null && (typeof row.reason !== 'string' || row.reason.length > 1000)) ||
    (row.active &&
      (typeof row.reason !== 'string' ||
        (row.permanent ? row.expiresAt !== null : row.expiresAt === null))) ||
    (!row.active && (row.permanent || row.reason !== null || row.expiresAt !== null))
  )
    throw new Error('Invalid account status')
  return {
    active: row.active,
    permanent: row.permanent,
    expiresAt: row.expiresAt as string | null,
    reason: row.reason as string | null,
    serverTime: row.serverTime as string,
  }
}
