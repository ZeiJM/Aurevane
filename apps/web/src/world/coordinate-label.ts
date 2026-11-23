import { mainlandSectorNumber, VOID_SECTOR_NUMBER_OFFSET } from './sector-index'
import type { WorldAtlasCell, WorldPosition, WorldSector } from './types'
import { parseVoidSectorId, VOID_REALM_COLUMNS, VOID_REALM_ROWS } from './void-realms'

type DisplaySector = Pick<WorldSector, 'id' | 'coordinate' | 'charted'> &
  Partial<
    Pick<WorldSector, 'atlasColumn' | 'atlasRow' | 'sceneColumn' | 'sceneRow' | 'warpedTheme'>
  > &
  Partial<Pick<WorldAtlasCell, 'column' | 'row'>>

function gridNumber(
  column: number | undefined,
  row: number | undefined,
  columns: number,
  rows: number,
) {
  return column !== undefined &&
    row !== undefined &&
    Number.isInteger(column) &&
    Number.isInteger(row) &&
    column >= 0 &&
    column < columns &&
    row >= 0 &&
    row < rows
    ? VOID_SECTOR_NUMBER_OFFSET + row * columns + column + 1
    : null
}

/** A stable chart number independent of the player’s loaded or discovered sectors. */
export function sectorDisplayNumber(sector: DisplaySector | undefined): number | null {
  if (!sector) return null
  const address = parseVoidSectorId(sector.id)
  if (address) return gridNumber(address.column, address.row, VOID_REALM_COLUMNS, VOID_REALM_ROWS)
  if (sector.id.startsWith('uncharted-'))
    return gridNumber(sector.sceneColumn, sector.sceneRow, VOID_REALM_COLUMNS, VOID_REALM_ROWS)
  if (!sector.charted || sector.warpedTheme) return null
  if (sector.atlasColumn !== undefined || sector.atlasRow !== undefined)
    return mainlandSectorNumber(sector.atlasColumn ?? -1, sector.atlasRow ?? -1)
  if (sector.column !== undefined || sector.row !== undefined)
    return mainlandSectorNumber(sector.column ?? -1, sector.row ?? -1)
  const coordinate = /^S(\d{2,3})-(\d{2,3})$/.exec(sector.coordinate)
  return coordinate
    ? mainlandSectorNumber(Number(coordinate[1]) - 1, Number(coordinate[2]) - 1)
    : null
}

export function sectorLabel(sector: DisplaySector | undefined): string {
  return `Sector ${sectorDisplayNumber(sector) ?? '?'}`
}

export function positionLabel(
  sector: DisplaySector | undefined,
  position: Pick<WorldPosition, 'x' | 'y'> & Partial<Pick<WorldPosition, 'sectorId'>>,
): string {
  const id = position.sectorId ?? sector?.id ?? ''
  const masked = sector?.warpedTheme || id.startsWith('void:') || id.startsWith('uncharted-')
  return `${sectorLabel(sector)} · X:${masked ? '?' : position.x} · Y:${masked ? '?' : position.y}`
}
