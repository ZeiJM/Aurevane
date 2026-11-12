import 'server-only'

import { terrainWalkable } from '@/world/terrain'
import { supercontinentTerrain } from './supercontinent-terrain'

import { GRID_HEIGHT, GRID_WIDTH, STEP_MS } from '@/world/catalog'
import type {
  WorldArchiveEntry,
  WorldLandmark,
  WorldPosition,
  WorldSector,
  WorldState,
  WorldWarpedScenery,
} from '@/world/types'

export const WARPED_CONTINENT_LANDING: WorldPosition = { sectorId: 'uncharted-landing', x: 6, y: 4 }

const districts = [
  ['glass', 1, 0, 2],
  ['belfry', 2, 0, 1],
  ['pale', 3, 0, 3],
  ['orchard', 0, 1, 0],
  ['landing', 1, 1, 4],
  ['mirrors', 2, 1, 5],
  ['cinders', 3, 1, 1],
  ['verge', 0, 2, 4],
  ['tarn', 1, 2, 0],
  ['spiral', 2, 2, 3],
  ['geodes', 3, 2, 5],
  ['shale', 1, 3, 2],
  ['relic', 2, 3, 4],
] as const

const districtScenery: Partial<
  Record<string, readonly [WorldWarpedScenery['sheet'], number, number, number]>
> = {
  'uncharted-glass': ['void-relics', 0, 7, 2],
  'uncharted-belfry': ['void-dressing', 1, 5, 6],
  'uncharted-pale': ['void-relics', 1, 7, 6],
  'uncharted-orchard': ['void-dressing', 0, 5, 2],
  'uncharted-landing': ['void-frontier', 0, 8, 3],
  'uncharted-mirrors': ['void-relics', 2, 6, 6],
  'uncharted-cinders': ['void-relics', 3, 6, 2],
  'uncharted-verge': ['void-frontier', 0, 4, 6],
  'uncharted-tarn': ['void-frontier', 1, 5, 2],
  'uncharted-spiral': ['void-frontier', 2, 6, 6],
  'uncharted-geodes': ['void-dressing', 3, 8, 2],
  'uncharted-shale': ['void-dressing', 2, 4, 6],
  'uncharted-relic': ['void-frontier', 3, 7, 2],
}
export function warpedDistrictScenery(sectorId: string): WorldWarpedScenery | undefined {
  const art = districtScenery[sectorId]
  if (!art) return
  const [sheet, index, x, y] = art
  return { sheet, index, x, y }
}

const themes = [
  {
    theme: 'haven',
    region: 'verdant-expanse',
    name: 'Ivory Orchard',
    landmark: 'The Blooming Gate',
    kind: 'grove',
    art: 0,
  },
  {
    theme: 'ashen',
    region: 'umbral-march',
    name: 'The Ashen Silence',
    landmark: 'Belfry of Last Light',
    kind: 'ruin',
    art: 1,
  },
  {
    theme: 'fracture',
    region: 'starfall-highlands',
    name: 'Glassfall Reach',
    landmark: 'The Sundering Observatory',
    kind: 'ruin',
    art: 2,
  },
  {
    theme: 'fracture',
    region: 'starfall-highlands',
    name: 'Pale Fracture',
    landmark: 'The Suspended Fault',
    kind: 'waystone',
    art: 3,
  },
  {
    theme: 'wayfarer',
    region: 'aureth-crown',
    name: 'Wayfarer’s Verge',
    landmark: 'The Lost Expedition',
    kind: 'camp',
    art: 4,
  },
  {
    theme: 'amber',
    region: 'glasswind-desert',
    name: 'Amber Resonance',
    landmark: 'The Singing Geodes',
    kind: 'spring',
    art: 5,
  },
  {
    theme: 'amethyst',
    region: 'starfall-highlands',
    name: 'Amethyst Tarn',
    landmark: 'The Violet Mirror',
    kind: 'spring',
    art: 3,
  },
] as const

const coord = (x: number, y: number) => `${x}:${y}`
const districtId = (key: string) => `uncharted-${key}`
const byAddress = new Map(districts.map((district) => [coord(district[1], district[2]), district]))
const expanseAddress = (id: string) => {
  const match = /^uncharted-expanse:(0|[1-9][0-9]?):(0|[1-9][0-9]?)$/.exec(id)
  if (!match || match[0] !== id) return null
  const column = Number(match[1]),
    row = Number(match[2])
  if (column >= 64 || row >= 48 || byAddress.has(coord(column, row))) return null
  return { column, row }
}
const sectorAt = (column: number, row: number) =>
  byAddress.get(coord(column, row))?.[0]
    ? districtId(byAddress.get(coord(column, row))![0])
    : column >= 0 && column < 64 && row >= 0 && row < 48
      ? `uncharted-expanse:${column}:${row}`
      : null
const legacyCrossing = (
  column: number,
  row: number,
  dx: number,
  dy: number,
  x: number,
  y: number,
) => {
  const id = sectorAt(column + dx, row + dy)
  return id &&
    (privateLegacyId(id) ||
      terrainWalkable(
        supercontinentTerrain(
          (column + dx) * GRID_WIDTH + x,
          (row + dy) * GRID_HEIGHT + y,
          0,
          true,
        ),
      ))
    ? id
    : null
}
const privateLegacyId = (id: string) => districts.some(([key]) => districtId(key) === id)
const directions = [
  [-1, 0, 0, 4, 12, 4],
  [1, 0, 12, 4, 0, 4],
  [0, -1, 6, 0, 6, 8],
  [0, 1, 6, 8, 6, 0],
] as const

function districtTerrain(key: string, column: number, row: number, style: number) {
  return Array.from({ length: GRID_HEIGHT }, (_, y) =>
    Array.from({ length: GRID_WIDTH }, (_, x) => {
      if (key === 'landing' && x >= 4 && x <= 8 && y >= 3 && y <= 5) return 's'
      if (x === 0) return y === 4 && legacyCrossing(column, row, -1, 0, 12, y) ? '=' : '#'
      if (x === 12) return y === 4 && legacyCrossing(column, row, 1, 0, 0, y) ? '=' : '#'
      if (y === 0) return x === 6 && legacyCrossing(column, row, 0, -1, x, 8) ? '=' : '#'
      if (y === 8) return x === 6 && legacyCrossing(column, row, 0, 1, x, 0) ? '=' : '#'
      // A shared central approach keeps every exit and point of interest reachable.
      if (x === 6 || y === 4) return '.'
      if ((y === 3 && x >= 4 && x <= 6) || (y === 5 && x >= 6 && x <= 8)) return '.'
      const lake = key === 'tarn' || key === 'mirrors'
      const poolDistance = ((x - (key === 'mirrors' ? 9 : 3.3)) / 3) ** 2 + ((y - 6) / 1.65) ** 2
      if (lake && poolDistance < 1) return '~'
      const ripple = (x * 29 + y * 67 + style * 13 + column * 23 + row * 31) % 53
      if (ripple < 7 && style !== 0) return '#'
      return ripple < (style === 0 ? 23 : 13) ? 't' : '.'
    }).join(''),
  )
}

export const warpedContinentSectors: readonly WorldSector[] = districts.map(
  ([key, column, row, style]) => ({
    id: districtId(key),
    name: key === 'landing' ? 'Expedition Landing' : themes[style].name,
    coordinate: 'Beyond the charts',
    regionId: themes[style].region,
    art: null,
    east: column,
    north: row,
    sceneColumn: column,
    sceneRow: row,
    charted: false,
    warpedTheme: themes[style].theme,
    rows: districtTerrain(key, column, row, style),
    landmarks: [],
    roads: directions.flatMap(([dx, dy, x, y, targetX, targetY]) => {
      const neighbor = legacyCrossing(column, row, dx, dy, targetX, targetY)
      return neighbor
        ? [
            {
              from: { sectorId: districtId(key), x, y },
              to: { sectorId: neighbor, x: targetX, y: targetY },
              durationMs: STEP_MS,
              name: 'Follow the passage',
            },
          ]
        : []
    }),
  }),
)

const privateIds = new Set(warpedContinentSectors.map((sector) => sector.id))
export const isWarpedContinentSector = (id: string) =>
  privateIds.has(id) || expanseAddress(id) !== null

/** Cheap local IDs, never a continent scan or terrain generation. */
export function warpedContinentSceneIds(id: string): string[] {
  const legacy = warpedContinentSectors.find((sector) => sector.id === id)
  const address = legacy ? { column: legacy.east, row: legacy.north } : expanseAddress(id)
  if (!address) return []
  return Array.from({ length: 25 }, (_, index) => {
    const candidate = sectorAt(
      address.column + (index % 5) - 2,
      address.row + Math.floor(index / 5) - 2,
    )
    return candidate ? [candidate] : []
  }).flat()
}

const expanseCache = new Map<string, WorldSector>()
export function resolveWarpedContinentSector(id: string): WorldSector | null {
  const legacy = warpedContinentSectors.find((sector) => sector.id === id)
  if (legacy) return legacy
  const address = expanseAddress(id)
  if (!address) return null
  const cached = expanseCache.get(id)
  if (cached) {
    expanseCache.delete(id)
    expanseCache.set(id, cached)
    return cached
  }
  const { column, row } = address
  const rows = Array.from({ length: GRID_HEIGHT }, (_, y) =>
    Array.from({ length: GRID_WIDTH }, (_, x) =>
      supercontinentTerrain(column * GRID_WIDTH + x, row * GRID_HEIGHT + y, 0, true),
    ).join(''),
  )
  const roads: WorldSector['roads'][number][] = []
  const cross = (
    x: number,
    y: number,
    dx: number,
    dy: number,
    targetX: number,
    targetY: number,
  ) => {
    const targetId = sectorAt(column + dx, row + dy)
    if (!targetId || !terrainWalkable(rows[y]![x]!)) return
    const old = warpedContinentSectors.find((sector) => sector.id === targetId)
    const target =
      old?.rows[targetY]?.[targetX] ??
      supercontinentTerrain(
        (column + dx) * GRID_WIDTH + targetX,
        (row + dy) * GRID_HEIGHT + targetY,
        0,
        true,
      )
    if (!terrainWalkable(target)) return
    roads.push({
      from: { sectorId: id, x, y },
      to: { sectorId: targetId, x: targetX, y: targetY },
      durationMs: STEP_MS,
      name: 'Follow the passage',
    })
  }
  for (let y = 0; y < GRID_HEIGHT; y++) {
    cross(0, y, -1, 0, 12, y)
    cross(12, y, 1, 0, 0, y)
  }
  for (let x = 0; x < GRID_WIDTH; x++) {
    cross(x, 0, 0, -1, x, 8)
    cross(x, 8, 0, 1, x, 0)
  }
  const sector: WorldSector = {
    id,
    name: 'Uncharted interior',
    coordinate: 'Beyond the charts',
    regionId: 'umbral-march',
    art: null,
    east: column,
    north: row,
    sceneColumn: column,
    sceneRow: row,
    charted: false,
    warpedTheme: row > 25 ? 'haven' : column > 36 ? 'amber' : 'fracture',
    landscape: row > 25 ? 'wildflowers' : undefined,
    rows,
    landmarks: [],
    roads,
  }
  expanseCache.set(id, sector)
  if (expanseCache.size > 192) expanseCache.delete(expanseCache.keys().next().value!)
  return sector
}

const districtNames = {
  glass: 'Glassfall',
  belfry: 'The Last Belfry',
  pale: 'Pale Ravine',
  orchard: 'Silver Orchard',
  mirrors: 'Broken Mirrors',
  cinders: 'Cinderfields',
  verge: 'Sheltered Verge',
  tarn: 'The Split Tarn',
  spiral: 'Spiral Downs',
  geodes: 'Amber Shelf',
  shale: 'Shale Wilderness',
  relic: 'Relic Valley',
} as const

const commonLandmarks = new Set(['glass', 'belfry', 'orchard', 'mirrors', 'spiral', 'geodes'])
const phaseVegetation: Partial<
  Record<NonNullable<WorldSector['warpedTheme']>, WorldSector['landscape']>
> = {
  haven: 'sakura',
  wayfarer: 'wildflowers',
  amber: 'autumn',
  amethyst: 'wisteria',
}
const refuges: readonly {
  key: string
  modulo: number
  remainder: number
  art: number
  name: string
  kind: WorldLandmark['kind']
}[] = [
  { key: 'verge', modulo: 4, remainder: 0, art: 7, name: 'Lantern Refuge', kind: 'hamlet' },
  { key: 'cinders', modulo: 4, remainder: 1, art: 8, name: 'The Unfinished Village', kind: 'ruin' },
  { key: 'relic', modulo: 5, remainder: 3, art: 11, name: 'Sporelight Homes', kind: 'hamlet' },
]
const rare: readonly {
  key: string
  modulo: number
  remainder: number
  art: number
  title: string
  summary: string
}[] = [
  {
    key: 'tarn',
    modulo: 11,
    remainder: 7,
    art: 3,
    title: 'The Violet Mirror',
    summary:
      'The still water carried violet light under the surface. One reflection showed the lake before the banks had broken.',
  },
  {
    key: 'mirrors',
    modulo: 19,
    remainder: 12,
    art: 3,
    title: 'The Twin Glass',
    summary:
      'Each half of the lilac pool returned the other half’s reflection. Neither showed the person on its bank.',
  },
  {
    key: 'orchard',
    modulo: 13,
    remainder: 8,
    art: 9,
    title: 'The Meteor Lily',
    summary:
      'A living lily opened inside a ring of suspended stones. The pale roots had grown through rock without cracking it.',
  },
  {
    key: 'pale',
    modulo: 17,
    remainder: 3,
    art: 10,
    title: 'The Misaligned Gate',
    summary:
      'Two pieces of the same arch hung at different angles. The carving met across the gap only when viewed from the south.',
  },
  {
    key: 'geodes',
    modulo: 7,
    remainder: 3,
    art: 5,
    title: 'The First Resonance',
    summary:
      'Three amber crystals answered one another as the light faded. The rhythm continued after the wind stopped.',
  },
]
const rareId = (key: string) => `warped-observation-${key}`

export function warpedFieldObservations(state: WorldState): WorldArchiveEntry[] {
  const recorded = new Set(state.warpedDiscoveries)
  return rare
    .filter((entry) => recorded.has(rareId(entry.key)))
    .map(({ key, title, summary }) => ({
      id: rareId(key),
      kind: 'field-observation',
      title,
      location: districtNames[key as keyof typeof districtNames],
      summary,
      provenance: 'Expedition field observation',
    }))
}

export function recordWarpedFieldObservation(state: WorldState, sector: WorldSector): WorldState {
  if (!isWarpedContinentSector(sector.id) || state.route.length > 0) return state
  const found = sector.landmarks.find(
    (landmark) =>
      landmark.id.startsWith('warped-observation-') &&
      landmark.x === state.position.x &&
      landmark.y === state.position.y,
  )
  if (!found || state.warpedDiscoveries?.includes(found.id)) return state
  return { ...state, warpedDiscoveries: [...(state.warpedDiscoveries ?? []), found.id] }
}

/** The authoritative ferry pins this phase for an entire expedition. */
export function applyWarpedContinentPhase(state: WorldState, sector: WorldSector): WorldSector {
  if (!isWarpedContinentSector(sector.id)) return sector
  const phase =
    Number.isSafeInteger(state.warpedPhase) && state.warpedPhase! >= 0 ? state.warpedPhase! : 0
  const fixed = sector.id === WARPED_CONTINENT_LANDING.sectorId
  const district = byAddress.get(coord(sector.east, sector.north))
  if (!district) return sector
  const key = district[0]
  const rareLake = (key === 'tarn' && phase % 11 === 7) || (key === 'mirrors' && phase % 19 === 12)
  // Purple water is deliberately rare; the lake footprint and all walkability stay fixed.
  const theme = fixed ? themes[4] : rareLake ? themes[6] : themes[(district[3] + (phase % 6)) % 6]!
  const landmarks: WorldLandmark[] = []
  if (fixed || (commonLandmarks.has(key) && phase % 3 !== (district[1] + district[2]) % 3))
    landmarks.push({
      id: `${sector.id}-feature-${theme.art}`,
      name: theme.landmark,
      kind: theme.kind,
      warpedArt: theme.art,
      x: 4,
      y: 3,
    })
  const refuge = refuges.find((item) => key === item.key && phase % item.modulo === item.remainder)
  if (refuge)
    landmarks.push({
      id: `${sector.id}-refuge`,
      name: refuge.name,
      kind: refuge.kind,
      warpedArt: refuge.art,
      x: 4,
      y: 3,
    })
  const observation = rare.find(
    (item) => key === item.key && phase % item.modulo === item.remainder,
  )
  if (observation)
    landmarks.push({
      id: rareId(key),
      name: observation.title,
      kind: 'waystone',
      warpedArt: observation.art,
      x: 8,
      y: 5,
    })
  return {
    ...sector,
    name: key === 'landing' ? sector.name : `${districtNames[key]} · ${theme.name}`,
    regionId: theme.region,
    warpedTheme: theme.theme,
    landscape: phaseVegetation[theme.theme],
    landmarks,
  }
}
