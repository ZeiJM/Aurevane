import {
  ATLAS_GEOGRAPHIC_SCALE,
  CHARTED_SECTORS,
  GRID_HEIGHT,
  GRID_WIDTH,
  STEP_MS,
  WORLD_REGIONS,
} from './catalog'
import { generateSectorTerrain, seeded } from './terrain-gen'
import {
  GRAND_DISCOVERY_SITES,
  REMOTE_GRAND_CROSSING,
  remoteCrossingWaterAt,
} from './discovery-sites'
import { terrainWalkable } from './terrain'
import { structuralTerrainAt } from './discovery-collision'
import { trimRoadShorelines } from './road-shorelines'
import type { WorldBuilding, WorldLandmark, WorldRoad, WorldSector } from './types'
import { ATLAS_COLUMNS, ATLAS_ROWS, atlasNeighbor, wrappedColumnDistance } from './topology'

export { ATLAS_COLUMNS, ATLAS_ROWS } from './topology'
export const WORLD_LAND_NAME = 'Isola'

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
const inDiscoveryGrounds = (x: number, y: number) =>
  GRAND_DISCOVERY_SITES.some(
    (site) =>
      x >= site.left &&
      x < site.left + site.width &&
      y >= site.top &&
      y < site.top + site.height + 2,
  )

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
  // The elemental valley sits on a real traversable mountain corridor, not ocean.
  ['frostmere', 'emberreach'],
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
// Each entry is one authored district block in west-to-east, north-to-south order.
// Long facades stay two cells deep: an old saved position always has a nearby exit.
const townDistricts: readonly (readonly [number, number, number, number])[][] = [
  [
    [1, 1, 4, 2],
    [8, 0, 4, 2],
    [2, 6, 3, 2],
    [0, 6, 5, 2],
    [7, 1, 5, 2],
    [8, 6, 4, 2],
    [1, 0, 3, 2],
    [7, 6, 5, 2],
    [1, 6, 4, 2],
  ],
  [
    [1, 6, 4, 2],
    [8, 1, 4, 2],
    [1, 1, 4, 2],
    [1, 0, 3, 2],
    [7, 0, 5, 2],
    [8, 6, 3, 2],
    [2, 6, 3, 2],
    [0, 6, 5, 2],
    [8, 1, 3, 2],
  ],
  [
    [1, 0, 3, 2],
    [8, 6, 3, 2],
    [0, 6, 4, 2],
    [8, 0, 4, 2],
    [1, 1, 5, 2],
    [7, 6, 5, 2],
    [1, 6, 2, 3],
    [8, 1, 2, 3],
    [1, 0, 4, 2],
  ],
  [
    [1, 1, 2, 3],
    [8, 0, 4, 2],
    [1, 6, 5, 2],
    [7, 6, 4, 2],
    [0, 0, 5, 2],
    [1, 0, 3, 2],
    [8, 1, 3, 2],
    [0, 6, 4, 2],
    [7, 0, 5, 2],
  ],
  [
    [0, 6, 4, 2],
    [1, 0, 3, 2],
    [8, 1, 2, 3],
    [7, 6, 5, 2],
    [8, 0, 4, 2],
    [1, 6, 2, 3],
    [8, 6, 3, 2],
    [0, 0, 5, 2],
    [2, 1, 3, 2],
  ],
  [
    [8, 0, 3, 2],
    [0, 6, 5, 2],
    [1, 1, 2, 3],
    [8, 6, 4, 2],
    [1, 0, 4, 2],
    [7, 0, 5, 2],
    [1, 6, 4, 2],
    [7, 1, 2, 3],
    [0, 1, 5, 2],
  ],
  [
    [7, 6, 5, 2],
    [1, 1, 3, 2],
    [8, 0, 4, 2],
    [0, 0, 4, 2],
    [8, 6, 4, 2],
    [1, 6, 5, 2],
    [8, 1, 2, 3],
    [1, 0, 5, 2],
    [7, 0, 3, 2],
  ],
  [
    [8, 1, 3, 2],
    [1, 6, 5, 2],
    [0, 0, 3, 2],
    [8, 6, 2, 3],
    [7, 1, 4, 2],
    [1, 0, 5, 2],
    [0, 6, 4, 2],
    [8, 0, 3, 2],
    [1, 1, 4, 2],
  ],
]
const townGrandBuildings: readonly (readonly [number, number, number, number])[] = [
  [7, 1, 5, 2],
  [7, 6, 5, 2],
  [8, 1, 2, 3],
  [7, 1, 4, 2],
  [7, 6, 4, 2],
  [1, 6, 4, 2],
  [8, 1, 3, 2],
  [8, 6, 3, 2],
]
function townWater(index: number, x: number, y: number) {
  const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
  switch (index) {
    case 0:
      return Math.abs(x - (28 + 2.6 * Math.sin(y / 4) + Math.sin(y / 2))) < 1.7
    case 1:
      return ellipse(29, 7, 4.4, 2.5) < 1 + Math.sin(y * 1.4) * 0.12
    case 2:
      return ellipse(8, 18, 6.4, 5.2) < 1 + Math.sin(x * 0.8 + y) * 0.14
    case 3:
      return x > 32 + 2.2 * Math.sin(y / 4) && y > 2
    case 4:
      return ellipse(25, 7, 5.3, 3.6) < 1 + Math.sin(x + y) * 0.12
    case 5:
      return ellipse(30, 19, 5.5, 4) < 1 + Math.sin(x * 0.7 + y) * 0.16
    case 6:
      return ellipse(8, 7, 4.5, 3) < 1 || ellipse(29, 20, 5.2, 3.3) < 1
    default: {
      const radius = ellipse(19, 13, 16.5, 10.8)
      return radius > 0.67 && radius < 1.05 + Math.sin(x * 0.8 + y * 0.6) * 0.035
    }
  }
}
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
          if (authored && !town) {
            const value = authored.rows[y]![x]!
            return value === '#' ? (random() < 0.3 ? 't' : '.') : value
          }
          if (town) {
            const tx = (column - town.column + 1) * GRID_WIDTH + x,
              ty = (row - town.row + 1) * GRID_HEIGHT + y
            return townWater(buildingArt[regionId] ?? 0, tx, ty)
              ? 'w'
              : random() < 0.025
                ? 't'
                : '.'
          }
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
            grid[y]![x] !== 'l' &&
            grid[y]![x] !== 'w'
          )
            grid[y]![x] = town && (!isRoot || x < 10) ? 's' : '='
      // A continuous river along the forest/coastal meridian; bridges follow the avenues.
      const forest = roots.find((root) => root.id === 'verdant-expanse')!
      if (
        !town &&
        authored?.id !== 'coastal-road' &&
        column === forest.column &&
        row >= forest.row - 3 &&
        row <= forest.row + 8
      )
        for (let y = 0; y < GRID_HEIGHT; y++) grid[y]![10] = y >= 3 && y <= 5 ? '=' : '~'
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
      if (!town)
        for (let y = 0; y < GRID_HEIGHT; y++)
          for (let x = 0; x < GRID_WIDTH; x++) {
            if (
              (grid[y]![x] === 't' || grid[y]![x] === '#') &&
              inDiscoveryGrounds(column * GRID_WIDTH + x, row * GRID_HEIGHT + y)
            )
              grid[y]![x] = '.'
          }
      // Scenic cascade shallows share the public terrain authority. The existing
      // avenue crosses between its pools; no saved dry position becomes blocked.
      if (!town)
        for (const site of GRAND_DISCOVERY_SITES) {
          if (!('water' in site)) continue
          for (const cell of site.water) {
            const x = site.left + cell.x - column * GRID_WIDTH,
              y = site.top + cell.y - row * GRID_HEIGHT
            if (
              x >= 0 &&
              x < GRID_WIDTH &&
              y >= 0 &&
              y < GRID_HEIGHT &&
              grid[y]![x] !== '=' &&
              grid[y]![x] !== '~' &&
              grid[y]![x] !== 'l'
            )
              grid[y]![x] = 'w'
          }
        }
      // A real broad remote crossing preserves every historic avenue and walkable position.
      if (!town && column === REMOTE_GRAND_CROSSING.column && row >= 31 && row <= 33)
        for (let y = 0; y < GRID_HEIGHT; y++)
          for (let x = 0; x < GRID_WIDTH; x++)
            if (remoteCrossingWaterAt(column, row, x, y) && !['=', '~', 'l'].includes(grid[y]![x]!))
              grid[y]![x] = 'w'
      // Permanent structural walls use canonical movement terrain. Authored
      // roads and shallow/deep water retain their original collision rules.
      if (!town)
        for (let y = 0; y < GRID_HEIGHT; y++)
          for (let x = 0; x < GRID_WIDTH; x++)
            grid[y]![x] = structuralTerrainAt(
              column * GRID_WIDTH + x,
              row * GRID_HEIGHT + y,
              grid[y]![x]!,
            )
      const buildings: WorldBuilding[] = []
      const addBuilding = (x: number, y: number, width: number, height: number, index: number) => {
        if (
          Array.from({ length: height }, (_, dy) =>
            Array.from({ length: width }, (_, dx) => grid[y + dy]?.[x + dx]),
          )
            .flat()
            .some((t) => t === '~' || t === 'l' || t === 'w')
        )
          return
        const blocked = (cx: number, cy: number) =>
          (cx >= x && cx < x + width && cy >= y && cy < y + height) ||
          !terrainWalkable(grid[cy]?.[cx] ?? '#')
        // Reject overlaps and facades without an exit instead of painting walkable
        // holes beneath a supposedly solid building sprite.
        if (index !== 9) {
          if (
            (authored?.landmarks ?? []).some(
              (l) => l.x >= x && l.x < x + width && l.y >= y && l.y < y + height,
            ) ||
            (isRoot && x <= 2 && x + width > 2 && y <= 1 && y + height > 1)
          )
            return
          if (
            Array.from({ length: height }, (_, dy) =>
              Array.from({ length: width }, (_, dx) => grid[y + dy]?.[x + dx]),
            )
              .flat()
              .some((t) => t === 'b')
          )
            return
          for (let cy = 0; cy < GRID_HEIGHT; cy++)
            for (let cx = 0; cx < GRID_WIDTH; cx++) {
              if (!blocked(cx, cy)) continue
              if (
                ![
                  [1, 0],
                  [-1, 0],
                  [0, 1],
                  [0, -1],
                ].some(([dx, dy]) => !blocked(cx + dx!, cy + dy!))
              )
                return
            }
        }
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
        const dc = column - town.column + 1,
          dr = row - town.row + 1
        const district = dr * 3 + dc
        const [x, y, width, height] = isRoot
          ? townGrandBuildings[index]!
          : townDistricts[index]![district]!
        // The Crown's one-cell perimeter has broad four-cardinal gates.
        if (index === 1) {
          const wallAt = (cx: number, cy: number) => {
            const tx = dc * GRID_WIDTH + cx,
              ty = dr * GRID_HEIGHT + cy
            return (
              Math.abs(tx - 19) > 1 &&
              Math.abs(ty - 13) > 1 &&
              (((tx === 2 || tx === 36) && ty >= 2 && ty <= 24) ||
                ((ty === 2 || ty === 24) && tx >= 2 && tx <= 36))
            )
          }
          for (let cy = 0; cy < GRID_HEIGHT; cy++)
            for (let cx = 0; cx < GRID_WIDTH; cx++) {
              const ty = dr * GRID_HEIGHT + cy
              if (!wallAt(cx, cy)) continue
              const horizontal = ty === 2 || ty === 24
              let length = 1
              while (
                horizontal
                  ? cx + length < GRID_WIDTH && wallAt(cx + length, cy)
                  : cy + length < GRID_HEIGHT && wallAt(cx, cy + length)
              )
                length++
              if (!horizontal && cy > 0 && ty - 1 !== 2 && ty - 1 !== 24 && wallAt(cx, cy - 1))
                continue
              addBuilding(cx, cy, horizontal ? length : 1, horizontal ? 1 : length, 9)
              buildings.at(-1)!.wallFacing = horizontal ? 'south' : 'east'
              if (horizontal) cx += length - 1
            }
        }
        // A building is one coherent district footprint, not the repeated old root stamp.
        const candidates = [
          [Math.max(1, Math.min(x, 12 - width)), Math.max(1, y)],
          [1, 6],
          [7, 1],
          [7, 6],
          [1, 1],
          [2, 6],
          [8, 1],
          [8, 6],
          [2, 1],
        ]
        for (const [cx, cy] of candidates) {
          if (cx! + width > 12 || cy! + height > 9) continue
          const count = buildings.length
          addBuilding(cx!, cy!, width, height, isRoot ? 10 + index : index)
          if (buildings.length > count) break
        }
        // Clear shared cardinal avenues preserve historic coordinates and cross-town access.
        for (let cy = 0; cy < GRID_HEIGHT; cy++)
          for (let cx = 0; cx < GRID_WIDTH; cx++) {
            const tx = dc * GRID_WIDTH + cx,
              ty = dr * GRID_HEIGHT + cy
            if (ty === 13 || tx === 19) grid[cy]![cx] = isRoot && cx >= 10 ? '=' : 's'
          }
      }
      // Retain the original blocked volcanic rift and its legal crossing. The
      // new thermal shallows are a separate basin, not a replacement for lava.
      if (isRoot && regionId === 'emberreach')
        for (let y = 0; y < GRID_HEIGHT; y++) grid[y]![10] = y === 4 ? '=' : 'l'
      const landmarks: WorldLandmark[] = (authored?.landmarks ?? []).map((l) => ({ ...l }))
      if (!town && column === REMOTE_GRAND_CROSSING.column && row >= 31 && row <= 33)
        landmarks.push({
          id: `${id}:${row === REMOTE_GRAND_CROSSING.row ? 'grand-crossing' : 'stream-crossing'}`,
          name: row === REMOTE_GRAND_CROSSING.row ? 'Longwater Crossing' : 'River Crossing',
          kind: 'bridge',
          x: 6,
          y: 4,
        })
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
      }
      if (isRoot && regionId === 'emberreach')
        landmarks.push({ id: `${id}:bridge`, name: 'Bridge', kind: 'bridge', x: 10, y: 4 })
      if (town?.id === 'umbral-march' && row === town.row && Math.abs(column - town.column) === 1) {
        landmarks.push({
          id: `${id}:moat-bridge`,
          name: column < town.column ? 'West Moat Bridge' : 'East Moat Bridge',
          kind: 'bridge',
          x: column < town.column ? 3 : 9,
          y: 4,
        })
      } else if (!town && !scenicCenter && random() < 0.32) {
        // Reuse the existing wilderness content vocabulary; no rewards, NPCs or hidden lore.
        const candidates = generateSectorTerrain({
          id,
          arms: { w: 4, e: 4, n: true, s: true },
        }).landmarks
        for (const landmark of candidates.slice(0, 1))
          if (
            terrainWalkable(grid[landmark.y]![landmark.x]!) &&
            !inDiscoveryGrounds(column * GRID_WIDTH + landmark.x, row * GRID_HEIGHT + landmark.y)
          )
            landmarks.push(landmark)
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
