import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { MASTER_TELEPORT_GEOMETRY_VERSION, type PlayerTeleportDestination } from '@/master/players'
import { VOID_REALMS, VOID_REALM_COLUMNS, voidSectorId } from '@/world/void-realms'
import {
  mainlandSectorAtNumber,
  mainlandSectorCount,
  MAX_VOID_SECTOR_NUMBER,
  VOID_SECTOR_NUMBER_OFFSET,
} from '@/world/sector-index'
import { worldSurfaceRows } from '@/world/terrain'
import { isSafe } from '@/world/travel'
import type { WorldSector } from '@/world/types'

export { MASTER_TELEPORT_GEOMETRY_VERSION }
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
    Object.keys(source).length < 4 ||
    Object.keys(source).length > 5 ||
    Object.keys(source).some(
      (key) => !['map', 'sectorNumber', 'x', 'y', 'geometryVersion'].includes(key),
    )
  )
    invalid()
  if (source.map !== 'mainland' && source.map !== 'currentVoid') invalid()
  if (source.geometryVersion !== MASTER_TELEPORT_GEOMETRY_VERSION)
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Map coordinates changed. Refresh this page and review the teleport destination again.',
    )

  const mainland = source.map === 'mainland'
  const minimum = mainland ? 1 : VOID_SECTOR_NUMBER_OFFSET + 1
  const maximum = mainland ? mainlandSectorCount() : MAX_VOID_SECTOR_NUMBER
  if (
    !Number.isSafeInteger(source.sectorNumber) ||
    Number(source.sectorNumber) < minimum ||
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
export function teleportStorageNumber(destination: PlayerTeleportDestination) {
  return destination.map === 'mainland'
    ? destination.sectorNumber
    : destination.sectorNumber - VOID_SECTOR_NUMBER_OFFSET
}

export function masterTeleportGeometry(
  destination: PlayerTeleportDestination,
  resolve: (id: string) => WorldSector | null,
): MasterTeleportGeometry[] {
  const sectorNumber = teleportStorageNumber(destination)
  const sectors =
    destination.map === 'mainland'
      ? [mainlandSectorAtNumber(sectorNumber)]
      : VOID_REALMS.map((realm) =>
          resolve(
            voidSectorId(
              realm.id,
              (sectorNumber - 1) % VOID_REALM_COLUMNS,
              Math.floor((sectorNumber - 1) / VOID_REALM_COLUMNS),
            ),
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
      rows: worldSurfaceRows(actual),
      safeCells,
    }
  })
}
