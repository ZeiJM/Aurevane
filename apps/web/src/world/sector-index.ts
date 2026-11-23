import { atlasSectors, isIsolaHeartland } from './atlas'
import { ATLAS_COLUMNS, ATLAS_ROWS } from './topology'
import { ASTERWAKE_REGION_ID } from './asterwake'
import { VOID_REALM_COLUMNS, VOID_REALM_ROWS } from './void-realms'

export const VOID_SECTOR_NUMBER_OFFSET = ATLAS_COLUMNS * ATLAS_ROWS
export const MAX_VOID_SECTOR_NUMBER =
  VOID_SECTOR_NUMBER_OFFSET + VOID_REALM_COLUMNS * VOID_REALM_ROWS

let index: ReturnType<typeof createIndex> | undefined
function createIndex() {
  const heartland = []
  const outlying = []
  const remote = []
  for (const sector of atlasSectors()) {
    if (sector.regionId === ASTERWAKE_REGION_ID) remote.push(sector)
    else if (isIsolaHeartland(sector.atlasColumn!, sector.atlasRow!)) heartland.push(sector)
    else outlying.push(sector)
  }
  const ordered = heartland.concat(outlying, remote)
  return {
    ordered,
    byAddress: new Map(
      ordered.map((sector, i) => [sector.atlasRow! * ATLAS_COLUMNS + sector.atlasColumn!, i + 1]),
    ),
  }
}

export function mainlandSectorAtNumber(number: number) {
  index ??= createIndex()
  return index.ordered[number - 1]
}

export function mainlandSectorCount() {
  index ??= createIndex()
  return index.ordered.length
}

export function mainlandSectorNumber(column: number, row: number) {
  if (
    !Number.isInteger(column) ||
    !Number.isInteger(row) ||
    column < 0 ||
    column >= ATLAS_COLUMNS ||
    row < 0 ||
    row >= ATLAS_ROWS
  )
    return null
  index ??= createIndex()
  return index.byAddress.get(row * ATLAS_COLUMNS + column) ?? null
}

export function readSectorNumber(value: string) {
  const input = value.trim()
  if (!/^\d+$/.test(input)) return null
  const number = Number(input)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}
