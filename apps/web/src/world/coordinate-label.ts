import { ATLAS_COLUMNS, ATLAS_ROWS } from './topology'
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
    ? row * columns + column + 1
    : null
}

/** A display alias over the full geographic grid, never the loaded/known subset. */
export function sectorDisplayNumber(sector: DisplaySector | undefined): number | null {
  if (!sector) return null
  const address = parseVoidSectorId(sector.id)
  if (address) return gridNumber(address.column, address.row, VOID_REALM_COLUMNS, VOID_REALM_ROWS)
  if (sector.id.startsWith('uncharted-'))
    return gridNumber(sector.sceneColumn, sector.sceneRow, VOID_REALM_COLUMNS, VOID_REALM_ROWS)
  if (!sector.charted || sector.warpedTheme) return null
  if (sector.atlasColumn !== undefined || sector.atlasRow !== undefined)
    return gridNumber(sector.atlasColumn, sector.atlasRow, ATLAS_COLUMNS, ATLAS_ROWS)
  if (sector.column !== undefined || sector.row !== undefined)
    return gridNumber(sector.column, sector.row, ATLAS_COLUMNS, ATLAS_ROWS)
  const coordinate = /^S(\d{2,3})-(\d{2,3})$/.exec(sector.coordinate)
  return coordinate
    ? gridNumber(Number(coordinate[1]) - 1, Number(coordinate[2]) - 1, ATLAS_COLUMNS, ATLAS_ROWS)
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
