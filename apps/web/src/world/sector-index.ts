import { atlasChartAddresses, atlasSectors } from './atlas'
import { ATLAS_COLUMNS, ATLAS_ROWS } from './topology'
import { VOID_REALM_COLUMNS, VOID_REALM_ROWS } from './void-realms'

export const VOID_SECTOR_NUMBER_OFFSET = ATLAS_COLUMNS * ATLAS_ROWS
export const MAX_VOID_SECTOR_NUMBER =
  VOID_SECTOR_NUMBER_OFFSET + VOID_REALM_COLUMNS * VOID_REALM_ROWS

let index: Map<number, number> | undefined
let sectorsById: ReadonlyMap<string, ReturnType<typeof atlasSectors>[number]> | undefined

export function mainlandSectorIdAtNumber(number: number) {
  return atlasChartAddresses()[number - 1]?.id
}

export function mainlandSectorAtNumber(number: number) {
  const id = mainlandSectorIdAtNumber(number)
  if (!id) return
  sectorsById ??= new Map(atlasSectors().map((sector) => [sector.id, sector]))
  return sectorsById.get(id)
}

export function mainlandSectorCount() {
  return atlasChartAddresses().length
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
  index ??= new Map(
    atlasChartAddresses().map(({ column, row }, i) => [row * ATLAS_COLUMNS + column, i + 1]),
  )
  return index.get(row * ATLAS_COLUMNS + column) ?? null
}

export function readSectorNumber(value: string) {
  const input = value.trim()
  if (!/^\d+$/.test(input)) return null
  const number = Number(input)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}
