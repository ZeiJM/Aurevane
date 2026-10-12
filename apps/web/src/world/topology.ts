import { GRID_HEIGHT, GRID_WIDTH } from './catalog'
import type { WorldSector } from './types'

export const ATLAS_COLUMNS = 128
export const ATLAS_ROWS = 64
export const WORLD_MAP_WIDTH = ATLAS_COLUMNS * GRID_WIDTH

export function wrapAtlasColumn(column: number) {
  return ((column % ATLAS_COLUMNS) + ATLAS_COLUMNS) % ATLAS_COLUMNS
}
export function wrappedColumnDistance(a: number, b: number) {
  const distance = wrapAtlasColumn(a - b)
  return Math.min(distance, ATLAS_COLUMNS - distance)
}
/** Nearest longitude copy in map-tile units; north/south never wraps. */
export function wrappedMapX(x: number, referenceX: number) {
  return x + Math.round((referenceX - x) / WORLD_MAP_WIDTH) * WORLD_MAP_WIDTH
}
export function wrappedMapDistance(aX: number, aY: number, bX: number, bY: number) {
  return Math.abs(wrappedMapX(aX, bX) - bX) + Math.abs(aY - bY)
}
export function atlasNeighbor(column: number, row: number, dx: number, dy: number) {
  const targetRow = row + dy
  return targetRow < 0 || targetRow >= ATLAS_ROWS
    ? null
    : { column: wrapAtlasColumn(column + dx), row: targetRow }
}
export function sectorMapOrigin(
  sector: Pick<WorldSector, 'atlasColumn' | 'atlasRow' | 'charted'>,
  referenceX?: number,
) {
  const x = (sector.atlasColumn ?? 0) * GRID_WIDTH
  return {
    x:
      sector.charted && sector.atlasColumn !== undefined && referenceX !== undefined
        ? wrappedMapX(x, referenceX)
        : x,
    y: (sector.atlasRow ?? 0) * GRID_HEIGHT,
  }
}
