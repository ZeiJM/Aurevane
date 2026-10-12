import {
  ATLAS_GEOGRAPHIC_SCALE,
  CHARTED_SECTORS,
  GRID_HEIGHT,
  GRID_WIDTH,
  STEP_MS,
  WORLD_REGIONS,
} from './catalog'
import { generateSectorTerrain, seeded } from './terrain-gen'
import { terrainWalkable } from './terrain'
import { trimRoadShorelines } from './road-shorelines'
import type { WorldBuilding, WorldLandmark, WorldRoad, WorldSector } from './types'
import { ATLAS_COLUMNS, ATLAS_ROWS, atlasNeighbor, wrappedColumnDistance } from './topology'

export { ATLAS_COLUMNS, ATLAS_ROWS } from './topology'
export const WORLD_LAND_NAME = 'Aurethia'

export function atlasAddress(sector: Pick<WorldSector, 'atlasColumn' | 'atlasRow'>) {
  return typeof sector.atlasColumn === 'number' && typeof sector.atlasRow === 'number'
    ? { column: sector.atlasColumn, row: sector.atlasRow }
    : null
}
const originalAddress = (coordinate: string) => {
  const match = /^S(\d{2})-(\d{2})$/.exec(coordinate)
  return match
    ? {
        column: (Number(match[1]) - 1) * ATLAS_GEOGRAPHIC_SCALE,
        row: (Number(match[2]) - 1) * ATLAS_GEOGRAPHIC_SCALE,
      }
    : null
}
const roots = WORLD_REGIONS.map((region) => ({ ...region, ...originalAddress(region.sector)! }))
const addressKey = (column: number, row: number) => `${column}:${row}`
// Public countryside destinations span several sectors, with quiet open ground
// between them. They decorate the existing atlas without moving saved positions.
const scenicZones = [
  { column: 62, row: 28, landscape: 'sakura', name: 'Cherryblossom Grove', kind: 'grove', art: 7 },
  { column: 58, row: 27, landscape: 'autumn', name: 'Amberwood Glade', kind: 'grove', art: 6 },
  { column: 48, row: 22, landscape: 'wisteria', name: 'Wisteria Hollow', kind: 'ruin', art: 5 },
  { column: 69, row: 36, landscape: 'willow', name: 'Willow Cascades', kind: 'spring', art: 4 },
  {
    column: 50,
    row: 34,
    landscape: 'wildflowers',
    name: 'Wildflower Meadow',
    kind: 'grove',
    art: 7,
  },
] as const
const rootLinks = [
  ['aureth-crown', 'verdant-expanse'],
  ['aureth-crown', 'glasswind-desert'],
  ['aureth-crown', 'starfall-highlands'],
  ['starfall-highlands', 'frostmere'],
  ['verdant-expanse', 'emberreach'],
  ['verdant-expanse', 'hollow-coast'],
  ['emberreach', 'umbral-march'],
  ['hollow-coast', 'umbral-march'],
] as const
function segmentDistance(
  x: number,
  y: number,
  a: { column: number; row: number },
  b: { column: number; row: number },
) {
  const dx = b.column - a.column,
    dy = b.row - a.row
  const t = Math.max(0, Math.min(1, ((x - a.column) * dx + (y - a.row) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - a.column - t * dx, y - a.row - t * dy)
}
function originalLandAt(column: number, row: number) {
  return (
    roots.some((root) => Math.hypot(column - root.column, (row - root.row) * 1.12) <= 8.8) ||
    rootLinks.some(
      ([a, b]) =>
        segmentDistance(
          column,
          row,
          roots.find((r) => r.id === a)!,
          roots.find((r) => r.id === b)!,
        ) <= 3.3,
    )
  )
}
function longitudeCountrysideAt(column: number, row: number) {
  const longitude = (column * Math.PI * 2) / ATLAS_COLUMNS
  const latitude = 32 + Math.sin(longitude) * 1.5 + Math.sin(longitude * 2) * 0.7
  const width = 1.15 + Math.max(0, Math.cos(longitude)) ** 16 * 0.65
  return Math.abs(row - latitude) <= width
}
const buildingArt: Record<string, number> = {
  'verdant-expanse': 0,
  'aureth-crown': 1,
  frostmere: 2,
  'hollow-coast': 3,
  'glasswind-desert': 4,
  emberreach: 5,
  'starfall-highlands': 6,
  'umbral-march': 7,
}
const districtBlocks: readonly (readonly [number, number, number, number])[][] = [
  [
    [0, 0, 3, 2],
    [9, 6, 3, 2],
  ],
  [
    [0, 0, 3, 3],
    [9, 0, 3, 3],
  ],
  [
    [1, 0, 3, 2],
    [8, 6, 4, 2],
  ],
  [
    [0, 0, 3, 2],
    [0, 6, 3, 2],
  ],
  [
    [1, 0, 3, 2],
    [8, 0, 3, 2],
  ],
  [
    [0, 0, 4, 2],
    [9, 6, 3, 3],
  ],
  [
    [0, 6, 3, 2],
    [9, 0, 3, 3],
  ],
  [
    [0, 0, 3, 2],
    [9, 7, 3, 2],
  ],
]
function townStreet(index: number, x: number, y: number) {
  const dx = x - 19,
    dy = y - 13
  // A shared broad east-west approach keeps authored quest positions stable. The
  // rest of each town is laid out in district-wide coordinates, never repeated sectors.
  if (Math.abs(dy) <= 1) return true
  switch (index) {
    case 0:
      return (
        Math.abs(x - (14 + Math.round(5 * Math.sin(y / 7)))) <= 1 ||
        ((y === 5 || y === 22) && x > 6 && x < 30)
      )
    case 1:
      return (
        Math.abs(dx) <= 1 ||
        (x >= 7 && x <= 31 && y >= 4 && y <= 22 && (x <= 8 || x >= 30 || y <= 5 || y >= 21))
      )
    case 2:
      return Math.abs(dx) <= 1 || y === 4 || y === 22 || (x === 8 && y < 13) || (x === 30 && y > 13)
    case 3:
      return Math.abs(x - 30) <= 1 || (x === 9 && y > 13) || (y === 21 && x >= 9 && x <= 30)
    case 4:
      return Math.abs(dx) <= 1 || Math.abs(Math.hypot(dx / 1.25, dy) - 8) < 1.2
    case 5:
      return (
        Math.abs(dx) <= 1 ||
        (Math.abs(dx) + Math.abs(dy) >= 11 && Math.abs(dx) + Math.abs(dy) <= 13)
      )
    case 6:
      return (
        x === 19 ||
        (y === 5 && x >= 7 && x <= 19) ||
        (x === 7 && y >= 5 && y <= 13) ||
        (y === 21 && x >= 19 && x <= 31) ||
        (x === 31 && y >= 13 && y <= 21)
      )
    default:
      return (
        Math.abs(x - (18 + Math.floor(y / 7) * 2)) <= 1 ||
        (y === 6 && x <= 18) ||
        (y === 20 && x >= 21)
      )
  }
}
let cache: readonly WorldSector[] | null = null

/** Stable authored IDs occupy their geographic anchors; the space between is real terrain. */
export function atlasSectors(): readonly WorldSector[] {
  if (cache) return cache
  const authoredByAddress = new Map(
    CHARTED_SECTORS.flatMap((sector) => {
      const address = originalAddress(sector.coordinate)
      return address ? [[addressKey(address.column, address.row), sector] as const] : []
    }),
  )
  const sectors: WorldSector[] = []
  for (let row = 0; row < ATLAS_ROWS; row++)
    for (let column = 0; column < ATLAS_COLUMNS; column++) {
      const authored = authoredByAddress.get(addressKey(column, row))
      const existingLand = Boolean(authored || originalLandAt(column, row))
      if (!existingLand && !longitudeCountrysideAt(column, row)) continue
      const nearest = [...roots].sort(
        (a, b) =>
          Math.hypot(wrappedColumnDistance(column, a.column), row - a.row) -
          Math.hypot(wrappedColumnDistance(column, b.column), row - b.row),
      )[0]!
      const town = roots.find(
        (root) => Math.abs(column - root.column) <= 1 && Math.abs(row - root.row) <= 1,
      )
      const regionId = authored?.regionId ?? nearest.id
      const scenic =
        !town && !authored
          ? scenicZones.find(
              (zone) => Math.abs(column - zone.column) <= 1 && Math.abs(row - zone.row) <= 1,
            )
          : undefined
      const id = authored?.id ?? `atlas:${column}:${row}`
      const random = seeded(id)
      const isRoot = town?.id === id
      const grid = Array.from({ length: GRID_HEIGHT }, (_, y) =>
        Array.from({ length: GRID_WIDTH }, (_, x) => {
          if ((authored && !town) || isRoot) {
            const value = authored!.rows[y]![x]!
            return value === '#'
              ? town
                ? random() < 0.08
                  ? 't'
                  : '.'
                : random() < 0.3
                  ? 't'
                  : '.'
              : value
          }
          if (town) return random() < 0.06 ? 't' : '.'
          const roll = random()
          if (['emberreach', 'starfall-highlands', 'frostmere'].includes(regionId) && roll < 0.04)
            return '#'
          return roll <
            (scenic && scenic.landscape !== 'wildflowers'
              ? 0.32
              : regionId === 'glasswind-desert'
                ? 0.045
                : 0.1)
            ? 't'
            : '.'
        }),
      )
      // Streets span whole towns. Countryside has occasional routes and broad open
      // ground, rather than a paved crossroads stamped into every sector.
      for (let y = 0; y < GRID_HEIGHT; y++)
        for (let x = 0; x < GRID_WIDTH; x++)
          if (
            (town
              ? townStreet(
                  buildingArt[regionId] ?? 0,
                  (column - town.column + 1) * GRID_WIDTH + x,
                  (row - town.row + 1) * GRID_HEIGHT + y,
                )
              : y === 4 || (column % 4 === 0 && x === 6)) &&
            grid[y]![x] !== '~' &&
            grid[y]![x] !== 'l'
          )
            grid[y]![x] = town && (!isRoot || x < 10) ? 's' : '='
      // A continuous river along the forest/coastal meridian; bridges follow the avenues.
      const forest = roots.find((root) => root.id === 'verdant-expanse')!
      if (
        authored?.id !== 'coastal-road' &&
        column === forest.column &&
        row >= forest.row - 3 &&
        row <= forest.row + 8
      )
        for (let y = 0; y < GRID_HEIGHT; y++) grid[y]![10] = y >= 3 && y <= 5 ? '=' : '~'
      if (isRoot && regionId === 'emberreach')
        for (let y = 0; y < GRID_HEIGHT; y++) if (y < 3 || y > 5) grid[y]![10] = 'l'
      const scenicCenter = scenic?.column === column && scenic.row === row
      if (scenicCenter && scenic.landscape === 'willow') grid[2]![9] = '~'
      if (!existingLand) {
        const pondRandom = seeded(id + ':pond')
        if (pondRandom() < 0.15) {
          const centerX = pondRandom() < 0.5 ? 3 : 9
          const centerY = pondRandom() < 0.5 ? 1.9 : 6.1
          const radiusX = 1.8 + pondRandom() * 0.7
          const radiusY = 0.85 + pondRandom() * 0.4
          for (let y = 1; y < GRID_HEIGHT - 1; y++)
            for (let x = 1; x < GRID_WIDTH - 1; x++) {
              const shore = 1 + Math.sin(x * 1.7 + y * 2.3) * 0.12
              if (
                y !== 4 &&
                (column % 4 !== 0 || x !== 6) &&
                ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2 < shore
              )
                grid[y]![x] = '~'
            }
        }
      }
      const buildings: WorldBuilding[] = []
      const addBuilding = (x: number, y: number, width: number, height: number, index: number) => {
        if (
          Array.from({ length: height }, (_, dy) =>
            Array.from({ length: width }, (_, dx) => grid[y + dy]?.[x + dx]),
          )
            .flat()
            .some((t) => t === '~' || t === 'l')
        )
          return
        buildings.push({
          id: `${id}:building${buildings.length}`,
          x,
          y,
          width,
          height,
          artIndex: index,
        })
        for (let dy = 0; dy < height; dy++)
          for (let dx = 0; dx < width; dx++) grid[y + dy]![x + dx] = 'b'
      }
      if (town) {
        const index = buildingArt[regionId] ?? 0
        if (isRoot) {
          addBuilding(4, 1, 2, 2, index)
          addBuilding(8, 1, 2, 2, index)
          addBuilding(11, 1, 2, 2, 8)
          addBuilding(2, 3, 1, 1, -1)
          buildings.at(-1)!.propIndex = 1
          addBuilding(1, 0, 3, 1, -1)
          buildings.at(-1)!.propIndex = 0
        } else {
          // Different block footprints and massing per district, with large clear intervals.
          for (const [x, y, width, height] of districtBlocks[index] ?? districtBlocks[0]!)
            addBuilding(x, y, width, height, index)
        }
      }
      const landmarks: WorldLandmark[] = (authored?.landmarks ?? []).map((l) => ({ ...l }))
      if (scenicCenter) {
        landmarks.push({
          id: `${id}:scenic`,
          name: scenic.name,
          kind: scenic.kind,
          x: scenic.landscape === 'willow' ? 8 : 6,
          y: scenic.landscape === 'willow' ? 3 : 2,
          sceneryIndex: scenic.art,
        })
        // A real walkable approach connects the destination to the travelling path.
        const target = landmarks.at(-1)!
        for (let y = target.y; y <= 4; y++) grid[y]![target.x] = '.'
      }
      if (isRoot) {
        const settlement = landmarks.find((l) => l.kind === 'settlement')
        if (settlement) settlement.name = 'Town Square'
        landmarks.push({
          id: `${id}:marketplace`,
          name: 'Marketplace',
          kind: 'marketplace',
          x: 2,
          y: 1,
        })
        if (grid[4]![10] === '=')
          landmarks.push({ id: `${id}:bridge`, name: 'Bridge', kind: 'bridge', x: 10, y: 4 })
      } else if (!town && !scenicCenter && random() < 0.32) {
        // Reuse the existing wilderness content vocabulary; no rewards, NPCs or hidden lore.
        const candidates = generateSectorTerrain({
          id,
          arms: { w: 4, e: 4, n: true, s: true },
        }).landmarks
        for (const landmark of candidates.slice(0, 1))
          if (terrainWalkable(grid[landmark.y]![landmark.x]!)) landmarks.push(landmark)
      }
      // An authored interaction or POI is an approach tile, not a building footprint.
      for (const landmark of landmarks) {
        if (!terrainWalkable(grid[landmark.y]![landmark.x]!))
          grid[landmark.y]![landmark.x] = town && landmark.x < 10 ? 's' : '.'
        if (landmark.kind !== 'bridge')
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              if (grid[landmark.y + dy]?.[landmark.x + dx] === 't')
                grid[landmark.y + dy]![landmark.x + dx] = '.'
      }
      sectors.push({
        ...authored,
        id,
        name:
          authored?.name ??
          (scenicCenter
            ? scenic.name
            : town
              ? `${town.name} District`
              : `${nearest.name} Countryside`),
        coordinate: `S${String(column + 1).padStart(2, '0')}-${String(row + 1).padStart(2, '0')}`,
        regionId,
        art: authored?.art ?? null,
        panorama: authored?.panorama,
        atlasColumn: column,
        atlasRow: row,
        townId: town?.id,
        ...(scenic ? { landscape: scenic.landscape } : {}),
        buildings,
        east: column * GRID_WIDTH,
        north: (ATLAS_ROWS - row) * GRID_HEIGHT,
        rows: grid.map((r) => r.join('')),
        charted: true,
        generated: !authored,
        landmarks,
        roads: [],
      })
    }
  trimRoadShorelines(sectors)
  const byAddress = new Map(sectors.map((s) => [addressKey(s.atlasColumn!, s.atlasRow!), s]))
  // Cross any walkable pair on a shared edge: no invisible gate or decorative-only ground.
  for (const sector of sectors) {
    const roads: WorldRoad[] = []
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const address = atlasNeighbor(sector.atlasColumn!, sector.atlasRow!, dx, dy)
      const neighbor = address && byAddress.get(addressKey(address.column, address.row))
      if (!neighbor) continue
      for (let offset = 0; offset < (dx ? GRID_HEIGHT : GRID_WIDTH); offset++) {
        const from = {
          sectorId: sector.id,
          x: dx ? (dx > 0 ? GRID_WIDTH - 1 : 0) : offset,
          y: dy ? (dy > 0 ? GRID_HEIGHT - 1 : 0) : offset,
        }
        const to = {
          sectorId: neighbor.id,
          x: dx ? (dx > 0 ? 0 : GRID_WIDTH - 1) : offset,
          y: dy ? (dy > 0 ? 0 : GRID_HEIGHT - 1) : offset,
        }
        if (
          terrainWalkable(sector.rows[from.y]![from.x]!) &&
          terrainWalkable(neighbor.rows[to.y]![to.x]!)
        )
          roads.push({ from, to, durationMs: STEP_MS, name: neighbor.name })
      }
    }
    sector.roads = roads
  }
  cache = sectors
  return cache
}
