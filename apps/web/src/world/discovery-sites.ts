// Keep the basin centered on its established public ground.
export const SHADOWS_VIGIL_SCALE = 0.6
const valleyWidth = 60 * SHADOWS_VIGIL_SCALE
const valleyHeight = 40 * SHADOWS_VIGIL_SCALE
const valleyLeft = 929 - valleyWidth / 2
const valleyTop = Math.round(158 - 29 * SHADOWS_VIGIL_SCALE)
const valleyBasin = 158 - valleyTop

function valleyWaterShape(x: number, y: number) {
  const stream = y < 25 && Math.abs(x - (30 + Math.sin(y / 5) * 2)) < 1.8
  const basin = ((x - 30) / 15) ** 2 + ((y - 29) / 8) ** 2 < 1 + Math.sin(x * 0.7 + y * 0.4) * 0.055
  return stream || basin
}

const valleyWater = Array.from({ length: valleyHeight }, (_, y) =>
  Array.from({ length: valleyWidth }, (_, x) => ({ x, y })),
)
  .flat()
  .filter(({ x, y }) => {
    const worldX = valleyLeft + x
    const worldY = valleyTop + y
    if (worldY % 9 === 4 || worldX % 52 === 6) return false
    // The reduced cascade must not introduce water on a previously dry tile.
    return (
      valleyWaterShape(x / SHADOWS_VIGIL_SCALE, y / SHADOWS_VIGIL_SCALE) &&
      valleyWaterShape(worldX - 899, worldY - 129)
    )
  })
/** Public mainland art footprints. No interaction, reward or private geography is authored here. */
export const GRAND_DISCOVERY_SITES = [
  { id: 'remote-fortress', left: 1028, top: 262, width: 10, height: 6, regionId: 'umbral-march' },
  { id: 'abandoned-town', left: 872, top: 334, width: 12, height: 6, regionId: 'hollow-coast' },
  {
    id: 'elemental-valley',
    name: 'The Shadows’ Vigil',
    sectorId: 'atlas:71:16',
    left: valleyLeft,
    top: valleyTop,
    width: valleyWidth,
    height: valleyHeight,
    basinY: valleyBasin,
    regionId: 'verdant-expanse',
    water: valleyWater,
    // The new public corridor has no pre-existing deep-river cells; never
    // turn a historic walking tile into an impassable pond for scenic art.
    deepWater: [] as { x: number; y: number }[],
  },
  {
    id: 'remote-colosseum',
    name: 'The Thousand Steps',
    sectorId: 'atlas:44:37',
    left: 560,
    top: 316,
    width: 48,
    height: 36,
    regionId: 'glasswind-desert',
  },
] as const
export type GrandDiscoveryId = (typeof GRAND_DISCOVERY_SITES)[number]['id']

export function grandDiscoverySectorName(sectorId: string) {
  const site = GRAND_DISCOVERY_SITES.find(
    (site) => 'sectorId' in site && site.sectorId === sectorId,
  )
  return site && 'name' in site ? site.name : undefined
}

export const REMOTE_GRAND_CROSSING = {
  sectorId: 'atlas:71:32',
  landmarkId: 'atlas:71:32:grand-crossing',
  column: 71,
  row: 32,
  x: 6,
  y: 4,
} as const

export const OFFSHORE_DISCOVERY = {
  mainlandSectorId: 'atlas:103:29',
  bridgeSectorId: 'atlas:102:29',
  bridgeLandmarkId: 'atlas:102:29:bridge',
  islandSectorId: 'atlas:101:29',
  towerLandmarkId: 'atlas:101:29:tower',
  row: 29,
} as const

/** The sea channel opens onto the ocean on either side of the deck. */
export const OFFSHORE_SECTORS = [
  {
    id: OFFSHORE_DISCOVERY.bridgeSectorId,
    column: 102,
    name: 'The Farwater Span',
    rows: [
      '~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~',
      '.~~~~~~~~~~~~',
      '..~~~~~~~~~..',
      '..=======....',
      '..~~~~~~~....',
      '.~~~~~~~~~~..',
      '~~~~~~~~~~~~.',
      '~~~~~~~~~~~~~',
    ],
    landmark: { id: OFFSHORE_DISCOVERY.bridgeLandmarkId, x: 5, y: 4, kind: 'bridge' },
  },
  {
    id: OFFSHORE_DISCOVERY.islandSectorId,
    column: 101,
    name: 'Lanternward Isle',
    rows: [
      '~~~~~~~~~~~~~',
      '~~~~....~~~~~',
      '~~..t.....~~~',
      '~............',
      '~...........=',
      '~............',
      '~~...t...t...',
      '~~~~......~~~',
      '~~~~~~~~~~~~~',
    ],
    landmark: { id: OFFSHORE_DISCOVERY.towerLandmarkId, x: 6, y: 4, kind: 'watchtower' },
  },
] as const
/** A narrow three-sector watercourse widens naturally beneath the grand central avenue. */
export function remoteCrossingWaterAt(column: number, row: number, x: number, y: number) {
  if (column !== REMOTE_GRAND_CROSSING.column || row < 31 || row > 33 || y === 4) return false
  if ((row === 31 && y === 0) || (row === 33 && y === 8)) return false
  const centre = 6 + (row === 32 ? 0.1 : 0.3) * Math.sin((row * 9 + y) * 0.45)
  const width = row === 32 ? 0.75 + 2.2 * Math.exp(-(((y - 4) / 2.4) ** 2)) : 0.75
  return Math.abs(x - centre) < width
}
