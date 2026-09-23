import type { WorldPosition, WorldRegion, WorldRoad, WorldSector } from './types'

export const GRID_WIDTH = 13
export const GRID_HEIGHT = 9
export const STEP_MS = 1100
export const WORLD_REGIONS: readonly WorldRegion[] = [
  {
    id: 'aureth-crown',
    name: 'Aureth Crown',
    summary: 'Golden fields, old roads and the heart of civilization.',
    sector: 'S14-08',
    longitude: -29,
    latitude: 6,
    art: 'aureth-crown',
    color: '#b9a967',
  },
  {
    id: 'verdant-expanse',
    name: 'Verdant Expanse',
    summary: 'Ancient woodland, river settlements and forgotten paths.',
    sector: 'S18-08',
    longitude: 14,
    latitude: 2,
    art: 'verdant-expanse',
    color: '#447c53',
  },
  {
    id: 'emberreach',
    name: 'Emberreach',
    summary: 'Basalt citadels beneath the glow of the volcanic frontier.',
    sector: 'S21-06',
    longitude: 50,
    latitude: 25,
    art: 'emberreach',
    color: '#b75434',
  },
  {
    id: 'frostmere',
    name: 'Frostmere',
    summary: 'Snowbound passes and warm lights beneath the mountain peaks.',
    sector: 'S17-04',
    longitude: 0,
    latitude: 55,
    art: 'frostmere',
    color: '#a3cbd6',
  },
  {
    id: 'glasswind-desert',
    name: 'Glasswind Desert',
    summary: 'Wind-sculpted dunes and the traces of a buried civilization.',
    sector: 'S13-11',
    longitude: -40,
    latitude: -26,
    art: 'glasswind-desert',
    color: '#d9b165',
  },
  {
    id: 'hollow-coast',
    name: 'Hollow Coast',
    summary: 'Tidal ruins, weathered harbours and a haunted shoreline.',
    sector: 'S18-12',
    longitude: 21,
    latitude: -42,
    art: 'hollow-coast',
    color: '#789aa4',
  },
  {
    id: 'starfall-highlands',
    name: 'Starfall Highlands',
    summary: 'Violet crags, high observatories and strange lights in the sky.',
    sector: 'S13-05',
    longitude: -43,
    latitude: 34,
    art: 'starfall-highlands',
    color: '#9380b4',
  },
  {
    id: 'umbral-march',
    name: 'Umbral March',
    summary: 'Dark forests and watchfires on the dangerous frontier.',
    sector: 'S22-10',
    longitude: 57,
    latitude: -18,
    art: 'umbral-march',
    color: '#53636b',
  },
]

// Painted sector maps share a road/bridge grammar; collision rows are explicit authored data.
// # = trees/building/wall, ~ = river/chasm, . = wilderness, = = road, s = protected settlement.
const ROWS = [
  '######.###~##',
  '#sss##..##~..',
  '#s#s##..##~..',
  '#sss##....~..',
  'sssss========',
  '#sss##....~..',
  '###s#.....~..',
  '###s#.....~..',
  '###s==.###~##',
].map((row) => row.trim())
const LINKS: readonly [string, string, string, number][] = [
  ['aureth-crown', 'crown-road', 'Crown Road', STEP_MS],
  ['crown-road', 'verdant-expanse', 'Crown Road', STEP_MS],
  ['aureth-crown', 'glasswind-desert', 'Southern Caravan Road', 70000],
  ['aureth-crown', 'starfall-highlands', 'Highland Road', 65000],
  ['starfall-highlands', 'frostmere', 'Northern Pass', 75000],
  ['verdant-expanse', 'emberreach', 'Ember Road', 70000],
  ['verdant-expanse', 'hollow-coast', 'Coastal Road', 60000],
  ['emberreach', 'umbral-march', 'Eastern March Road', 85000],
  ['hollow-coast', 'umbral-march', 'Old Coast Road', 80000],
]
const roads: WorldRoad[] = LINKS.flatMap(([a, b, name, durationMs]) => [
  { from: { sectorId: a, x: 12, y: 4 }, to: { sectorId: b, x: 0, y: 4 }, name, durationMs },
  { from: { sectorId: b, x: 0, y: 4 }, to: { sectorId: a, x: 12, y: 4 }, name, durationMs },
])
export const CHARTED_SECTORS: readonly WorldSector[] = [
  ...WORLD_REGIONS.map((region): WorldSector => ({
    id: region.id,
    name: region.name,
    coordinate: region.sector,
    regionId: region.id,
    art: `/media/art/world/${region.art}-v01.webp`,
    panorama: `/media/art/world/${region.art}-panorama-v01.webp`,
    east: 12,
    north: 28,
    rows: ROWS,
    charted: true,
    landmarks: [
      { id: `${region.id}-settlement`, name: 'Settlement', kind: 'settlement', x: 2, y: 4 },
      { id: `${region.id}-watch`, name: 'Watchtower', kind: 'watchtower', x: 12, y: 4 },
      ...(region.id === 'umbral-march'
        ? [
            {
              id: 'last-survey',
              name: 'Last reliable survey',
              kind: 'frontier' as const,
              x: 6,
              y: 0,
            },
          ]
        : []),
    ],
    roads: roads.filter((road) => road.from.sectorId === region.id),
  })),
  {
    id: 'crown-road',
    name: 'Crown Road',
    coordinate: 'S16-08',
    regionId: 'aureth-crown',
    art: '/media/art/world/crown-road-v01.webp',
    panorama: '/media/art/world/crown-road-panorama-v01.webp',
    stepMs: 4000,
    east: 0,
    north: 8,
    rows: [
      '###...##~~###',
      '#..#..##~~###',
      '#.....##~~###',
      '.......#~~...',
      '=============',
      '.......#~~...',
      '#.....##~~###',
      '##...###~~###',
      '########~~###',
    ],
    charted: true,
    landmarks: [],
    roads: roads.filter((road) => road.from.sectorId === 'crown-road'),
  },
]
export const START_POSITION: WorldPosition = { sectorId: 'verdant-expanse', x: 5, y: 4 }
export const FRONTIER_APPROACH: WorldPosition = { sectorId: 'umbral-march', x: 6, y: 0 }
export function worldRegion(id: string) {
  return WORLD_REGIONS.find((region) => region.id === id)
}
