import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { PlayerTeleportDestination } from '@/master/players'
import { VOID_REALMS, voidSectorId } from '@/world/void-realms'
import { atlasSectors } from '@/world/atlas'
import { isSafe } from '@/world/travel'
import type { WorldSector } from '@/world/types'

/** Increment with any collision/safety change; an installed release is immutable. */
export const MASTER_TELEPORT_GEOMETRY_VERSION = '2026-11-12-v1'
export interface MasterTeleportGeometry {
  sectorId: string
  realmId: string | null
  sectorNumber: number
  rows: readonly string[]
  safeCells: number[]
}
function invalid(): never {
  throw new AurevaneError(
    'INVALID_REQUEST',
    'Choose an existing land sector and whole coordinates: X 0–12, Y 0–8.',
  )
}
export function parseMasterTeleportReason(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > 240)
    throw new AurevaneError('INVALID_REQUEST', 'Enter a staff reason between 3 and 240 characters.')
  return value.trim()
}
export function parseMasterTeleportDestination(value: unknown): PlayerTeleportDestination {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  const source = value as Record<string, unknown>
  if (
    Object.keys(source).length !== 4 ||
    Object.keys(source).some((key) => !['map', 'sectorNumber', 'x', 'y'].includes(key))
  )
    invalid()
  if (source.map !== 'mainland' && source.map !== 'currentVoid') invalid()
  const maximum = source.map === 'mainland' ? 8192 : 768
  if (
    !Number.isSafeInteger(source.sectorNumber) ||
    Number(source.sectorNumber) < 1 ||
    Number(source.sectorNumber) > maximum ||
    !Number.isSafeInteger(source.x) ||
    Number(source.x) < 0 ||
    Number(source.x) > 12 ||
    !Number.isSafeInteger(source.y) ||
    Number(source.y) < 0 ||
    Number(source.y) > 8
  )
    invalid()
  return source as unknown as PlayerTeleportDestination
}
/** Only the server resolver supplies rows. Prepare all possible current realms before the locked commit. */
export function masterTeleportGeometry(
  destination: PlayerTeleportDestination,
  resolve: (id: string) => WorldSector | null,
): MasterTeleportGeometry[] {
  const { sectorNumber } = destination
  const sectors =
    destination.map === 'mainland'
      ? atlasSectors().filter(
          (sector) =>
            sector.atlasColumn !== undefined &&
            sector.atlasRow !== undefined &&
            sector.atlasRow * 128 + sector.atlasColumn + 1 === sectorNumber,
        )
      : VOID_REALMS.map((realm) =>
          resolve(
            voidSectorId(realm.id, (sectorNumber - 1) % 32, Math.floor((sectorNumber - 1) / 32)),
          ),
        )
  if (!sectors.length || sectors.some((sector) => !sector)) invalid()
  return sectors.map((sector) => {
    const actual = sector!
    const safeCells: number[] = []
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 13; x++) if (isSafe(actual, { x, y })) safeCells.push(y * 13 + x)
    return {
      sectorId: actual.id,
      realmId: destination.map === 'mainland' ? null : actual.id.split(':')[1]!,
      sectorNumber,
      rows: actual.rows,
      safeCells,
    }
  })
}
