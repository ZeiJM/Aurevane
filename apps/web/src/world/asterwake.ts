import { GRID_HEIGHT, GRID_WIDTH } from './catalog'
import { FERRY_ASTERWAKE_DOCK } from './ferry'
import { hashString } from './terrain-gen'
import { ATLAS_ROWS, wrapAtlasColumn } from './topology'
import type { WorldSector } from './types'

export const ASTERWAKE_REGION_ID = 'asterwake'
export const ASTERWAKE_NAME = 'Asterwake'
export const ASTERWAKE_GOLDEN_TREE = { sectorId: 'atlas:6:9', x: 6, y: 4 } as const
export const ASTERWAKE_GOLDEN_TREE_ID = 'asterwake-golden-oak'

const shores = [
  { name: ASTERWAKE_NAME, x: 4, y: 9.5, width: 9.4, height: 5.55 },
  { name: 'The Kestrel Skerries', x: 15.5, y: 6, width: 2.2, height: 1.55 },
  { name: 'Morrow Isle', x: -8, y: 6, width: 1.8, height: 1.9 },
  { name: 'Copperwake Island', x: 11, y: 17.5, width: 2.1, height: 1.6 },
] as const

function distance(column: number, row: number, shore: (typeof shores)[number]) {
  const dx = wrapAtlasColumn(column - shore.x + 64) - 64
  const dy = row - shore.y
  return (
    Math.hypot((dx + dy * 0.39) / shore.width, dy / shore.height) +
    Math.sin(dx * 0.8 + dy * 1.5) * 0.075 +
    Math.cos(dy * 1.1 - dx * 0.52) * 0.095
  )
}

export function asterwakeCoastAt(column: number, row: number) {
  if (row > 20 || (column > 19 && column < 116)) return
  return `atlas:${column}:${row}` === FERRY_ASTERWAKE_DOCK.sectorId
    ? shores[0]
    : shores.find((coast) => distance(column, row, coast) <= 0.99)
}

export function asterwakeSector(column: number, row: number): WorldSector | undefined {
  const shore = asterwakeCoastAt(column, row)
  if (!shore) return
  const id = `atlas:${column}:${row}`
  const dock = id === FERRY_ASTERWAKE_DOCK.sectorId
  const golden = id === ASTERWAKE_GOLDEN_TREE.sectorId
  const rows = Array.from({ length: GRID_HEIGHT }, (_, y) =>
    Array.from({ length: GRID_WIDTH }, (_, x) => {
      if (
        column === 4 &&
        row >= 14 &&
        Math.abs(x - FERRY_ASTERWAKE_DOCK.x) <= (dock ? (y < 3 ? 4 : y < 6 ? 3 : 2) : 4)
      )
        return dock && x === FERRY_ASTERWAKE_DOCK.x && y >= 5 ? 's' : '.'
      if (golden && Math.abs(x - 6) <= 1 && Math.abs(y - 4) <= 1) return '#'
      const wx = column + (x + 0.5) / GRID_WIDTH - 0.5
      const wy = row + (y + 0.5) / GRID_HEIGHT - 0.5
      if (distance(wx, wy, shore) > 1.055) return '~'
      const seed = hashString(`${id}:${x}:${y}`)
      if (x > 0 && x < 12 && y > 0 && y < 8 && (seed % 61 < 2 || (y < 3 && seed % 9 < 1)))
        return '#'
      return seed % 13 < (golden ? 4 : 3) ? 't' : '.'
    }).join(''),
  )
  return {
    id,
    name: dock ? 'Asterwake Ferry Terminal' : golden ? 'Gildroot Grove' : shore.name,
    coordinate: `S${String(column + 1).padStart(2, '0')}-${String(row + 1).padStart(2, '0')}`,
    regionId: ASTERWAKE_REGION_ID,
    atlasColumn: column,
    atlasRow: row,
    east: column * GRID_WIDTH,
    north: (ATLAS_ROWS - row) * GRID_HEIGHT,
    charted: true,
    art: null,
    generated: true,
    rows,
    roads: [],
    landmarks: dock
      ? [
          {
            id: 'asterwake:ferry-terminal',
            name: 'Asterwake Ferry Terminal',
            kind: 'waystone',
            x: FERRY_ASTERWAKE_DOCK.x,
            y: FERRY_ASTERWAKE_DOCK.y,
          },
        ]
      : golden
        ? [{ id: ASTERWAKE_GOLDEN_TREE_ID, name: 'Gildroot Oak', kind: 'grove', x: 6, y: 6 }]
        : [],
  }
}
