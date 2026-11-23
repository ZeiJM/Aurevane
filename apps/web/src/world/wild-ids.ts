/** Identity and geometry of the endless generated wilds that grow beyond each authored region. */
export type MapDirection = 'north' | 'south' | 'east' | 'west'
export const MAP_DIRECTIONS: readonly MapDirection[] = ['west', 'east', 'north', 'south']
/** The middle tile of each sector edge: every road crosses a sector boundary here. */
export const EDGE_TILE: Record<MapDirection, { x: number; y: number }> = {
  west: { x: 0, y: 4 },
  east: { x: 12, y: 4 },
  north: { x: 6, y: 0 },
  south: { x: 6, y: 8 },
}
export const OPPOSITE: Record<MapDirection, MapDirection> = {
  west: 'east',
  east: 'west',
  north: 'south',
  south: 'north',
}
export const MAX_WILD_DISTANCE = 400
export interface WildAddress {
  root: string
  dir: MapDirection
  /** Sectors out from the region along `dir`, starting at 1. */
  k: number
  /** Sectors sideways (south/east positive), 0 on the road out of the region. */
  b: number
}
export const wildSectorId = ({ root, dir, k, b }: WildAddress) => `wild:${root}:${dir}:${k}:${b}`
export function parseWildId(id: string): WildAddress | null {
  const match = /^wild:([a-z][a-z-]*):(north|south|east|west):(\d{1,3}):(-?\d{1,3})$/.exec(id)
  if (!match) return null
  const k = Number(match[3]),
    b = Number(match[4])
  if (k < 1 || k > MAX_WILD_DISTANCE || Math.abs(b) > MAX_WILD_DISTANCE) return null
  return { root: match[1]!, dir: match[2] as MapDirection, k, b }
}
export const isWildSectorId = (id: string) => id.startsWith('wild:')
