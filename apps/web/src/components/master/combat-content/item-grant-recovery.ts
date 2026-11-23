import type { ItemGrantRequest } from '@/master/item-grant'

export const TARGET_ITEM_GRANT_ENDPOINT = '/api/master/combat-content/item-grant'
export const SELF_ITEM_GRANT_ENDPOINT = '/api/master/combat-content/item-test-grant'
type TargetGrant = Extract<ItemGrantRequest, { action: 'grant' }>
export type PreparedItemGrant = Readonly<{
  endpoint: typeof TARGET_ITEM_GRANT_ENDPOINT | typeof SELF_ITEM_GRANT_ENDPOINT
  body: TargetGrant | Omit<TargetGrant, 'action'>
  itemName: string
  recipient: string
}>
export function itemGrantRecoveryKey(accountScope: string): string | null {
  return accountScope ? `aurevane.master.item-grant.v1:${accountScope}` : null
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const uuid = (value: unknown) =>
  typeof value === 'string' &&
  /^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/.test(value)
/** Restore only our supported request contracts. SQL revalidates the current actor on every retry. */
export function parsePreparedItemGrant(raw: string | null): PreparedItemGrant | null {
  if (!raw || raw.length > 10_000) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (
      !object(value) ||
      !object(value.body) ||
      Object.keys(value).some(
        (key) => !['endpoint', 'body', 'itemName', 'recipient'].includes(key),
      ) ||
      typeof value.itemName !== 'string' ||
      !value.itemName.trim() ||
      value.itemName.length > 200 ||
      typeof value.recipient !== 'string' ||
      !value.recipient.trim() ||
      value.recipient.length > 160
    )
      return null
    const body = value.body
    const targeted = value.endpoint === TARGET_ITEM_GRANT_ENDPOINT
    if (!targeted && value.endpoint !== SELF_ITEM_GRANT_ENDPOINT) return null
    const keys = [
      'characterId',
      'itemId',
      'quantity',
      'expectedRevision',
      'catalogueToken',
      'requestId',
      ...(targeted ? ['action'] : []),
    ]
    if (
      Object.keys(body).some((key) => !keys.includes(key)) ||
      (targeted && body.action !== 'grant') ||
      !uuid(body.characterId) ||
      !uuid(body.requestId) ||
      typeof body.itemId !== 'string' ||
      !body.itemId.trim() ||
      body.itemId.length > 160 ||
      !Number.isSafeInteger(body.quantity) ||
      (body.quantity as number) < 1 ||
      (body.quantity as number) > 99 ||
      !Number.isSafeInteger(body.expectedRevision) ||
      (body.expectedRevision as number) < 0 ||
      typeof body.catalogueToken !== 'string' ||
      !/^[a-f0-9]{32}$/.test(body.catalogueToken)
    )
      return null
    return value as PreparedItemGrant
  } catch {
    return null
  }
}
