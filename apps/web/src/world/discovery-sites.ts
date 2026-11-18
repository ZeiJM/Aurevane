// Between Frostmere and Emberreach, on the authored public land corridor.
const valleyLeft = 899,
  valleyTop = 129
const valleyWater = Array.from({ length: 40 }, (_, y) =>
  Array.from({ length: 60 }, (_, x) => ({ x, y })),
)
  .flat()
  .filter(({ x, y }) => {
    // Existing avenues cross between cascades, rather than being concealed by new water.
    if ((valleyTop + y) % 9 === 4 || (valleyLeft + x) % 52 === 6) return false
    const stream = y < 25 && Math.abs(x - (30 + Math.sin(y / 5) * 2)) < 1.8
    const basin =
      ((x - 30) / 15) ** 2 + ((y - 29) / 8) ** 2 < 1 + Math.sin(x * 0.7 + y * 0.4) * 0.055
    return stream || basin
  })
/** Public mainland art footprints. No interaction, reward or private geography is authored here. */
export const GRAND_DISCOVERY_SITES = [
  { id: 'remote-fortress', left: 1028, top: 262, width: 10, height: 6, regionId: 'umbral-march' },
  { id: 'abandoned-town', left: 872, top: 334, width: 12, height: 6, regionId: 'hollow-coast' },
  {
    id: 'elemental-valley',
    left: valleyLeft,
    top: valleyTop,
    width: 60,
    height: 40,
    regionId: 'verdant-expanse',
    water: valleyWater,
    // The new public corridor has no pre-existing deep-river cells; never
    // turn a historic walking tile into an impassable pond for scenic art.
    deepWater: [] as { x: number; y: number }[],
  },
  {
    id: 'remote-colosseum',
    left: 560,
    top: 316,
    width: 48,
    height: 36,
    regionId: 'glasswind-desert',
  },
] as const
export type GrandDiscoveryId = (typeof GRAND_DISCOVERY_SITES)[number]['id']

export const REMOTE_GRAND_CROSSING = {
  sectorId: 'atlas:71:32',
  landmarkId: 'atlas:71:32:grand-crossing',
  column: 71,
  row: 32,
  x: 6,
  y: 4,
} as const
/** A narrow three-sector watercourse widens naturally beneath the grand central avenue. */
export function remoteCrossingWaterAt(column: number, row: number, x: number, y: number) {
  if (column !== REMOTE_GRAND_CROSSING.column || row < 31 || row > 33 || y === 4) return false
  if ((row === 31 && y === 0) || (row === 33 && y === 8)) return false
  const centre = 6 + (row === 32 ? 0.1 : 0.3) * Math.sin((row * 9 + y) * 0.45)
  const width = row === 32 ? 0.75 + 2.2 * Math.exp(-(((y - 4) / 2.4) ** 2)) : 0.75
  return Math.abs(x - centre) < width
}
