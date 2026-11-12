import type { WorldLandmark, WorldSectorView } from '@/world/types'

/** Give major sites a broader visual base only where all nine ground cells are supplied. */
export function landmarkArtSize(
  sector: WorldSectorView,
  landmark: WorldLandmark,
  ordinarySize: number,
): number {
  if (!['shrine', 'ruin', 'anchor', 'watchtower'].includes(landmark.kind)) return ordinarySize
  const left = landmark.x - 1,
    top = landmark.y - 1
  const overlaps = (x: number, y: number, width: number, height: number) =>
    x < left + 3 && x + width > left && y < top + 3 && y + height > top
  if (
    sector.buildings?.some((b) => overlaps(b.x, b.y, b.width, b.height)) ||
    sector.landmarks.some(
      (other) => other.id !== landmark.id && overlaps(other.x, other.y, 1, 1),
    ) ||
    (sector.warpedScenery && overlaps(sector.warpedScenery.x - 1, sector.warpedScenery.y - 1, 3, 3))
  )
    return ordinarySize
  for (let y = top; y < top + 3; y++)
    for (let x = left; x < left + 3; x++) {
      const cell = sector.cells.find((c) => c.x === x && c.y === y)
      if (!cell?.walkable || !['.', 's', 't'].includes(cell.terrain)) return ordinarySize
    }
  return Math.max(ordinarySize, 3.2)
}

/** Art identities never grant a crossing or change collision. */
export function grandBridgeArt(sector: WorldSectorView, span: number): number | undefined {
  if (!sector.townId && span < 4) return
  if (
    sector.warpedTheme ||
    sector.regionId === 'frostmere' ||
    sector.regionId === 'starfall-highlands'
  )
    return 2
  return sector.regionId === 'verdant-expanse' || sector.regionId === 'umbral-march' ? 1 : 0
}
export function waterfallArt(regionId: string) {
  return regionId === 'frostmere' || regionId === 'starfall-highlands'
    ? 1
    : regionId === 'emberreach'
      ? 2
      : 0
}
/** The original Emberreach channel has known dry banks below its road crossing. */
export function lavaFallSite(
  sector: WorldSectorView,
): { x: number; y: number; index: number } | undefined {
  if (sector.id !== 'emberreach' || !sector.charted) return
  const at = (x: number, y: number) => sector.cells.find((c) => c.x === x && c.y === y)
  for (const y of [5, 6, 7]) {
    if (at(10, y)?.terrain !== 'l' || at(10, y)?.walkable) return
    for (const x of [9, 11]) {
      const bank = at(x, y)
      if (!bank || bank.terrain === '=' || bank.terrain === '~' || bank.terrain === 'l') return
    }
  }
  if (sector.buildings?.some((b) => b.x < 12 && b.x + b.width > 9 && b.y < 8 && b.y + b.height > 5))
    return
  return { x: 10.5, y: 7.5, index: 1 }
}
