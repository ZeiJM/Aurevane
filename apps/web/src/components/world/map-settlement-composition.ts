import { hashString } from '@/world/terrain-gen'
import type { WorldSectorView } from '@/world/types'
import {
  hamletFamilyIndex,
  sceneryDressing,
  naturalDressing,
  type DressingSheet,
  type ScenicDressing,
} from './map-dressing'

type Piece = readonly [DressingSheet, number]
// Supporting uses differ by region; functional buildings and interaction anchors stay authored.
const kits: Record<string, readonly Piece[]> = {
  'aureth-crown': [
    ['hamlet-dressing', 0],
    ['settlement-dressing', 2],
    ['wild-verges', 0],
  ],
  'verdant-expanse': [
    ['settlement-dressing', 2],
    ['hamlet-dressing', 2],
    ['wild-verges', 0],
  ],
  frostmere: [
    ['settlement-dressing', 1],
    ['settlement-dressing', 0],
    ['wild-verges', 2],
  ],
  'starfall-highlands': [
    ['hamlet-dressing', 1],
    ['wild-verges', 2],
    ['hamlet-dressing', 0],
  ],
  emberreach: [
    ['hamlet-dressing', 1],
    ['settlement-dressing', 1],
    ['hamlet-dressing', 0],
  ],
  'glasswind-desert': [
    ['hamlet-dressing', 0],
    ['wild-verges', 3],
    ['settlement-dressing', 2],
  ],
  'hollow-coast': [
    ['settlement-dressing', 3],
    ['hamlet-dressing', 3],
    ['wild-verges', 1],
  ],
  'umbral-march': [
    ['hamlet-dressing', 2],
    ['wild-verges', 1],
    ['hamlet-dressing', 0],
  ],
}

/** Bounded working yards on supplied public dry cells, never a second placement authority. */
export function settlementComposition(sector: WorldSectorView): ScenicDressing[] {
  if (!sector.charted || sector.warpedTheme || sector.id.startsWith('ferry:')) return []
  const hamlet = sector.landmarks.find(
    (l) => l.kind === 'hamlet' && hamletFamilyIndex(l.name) !== undefined,
  )
  if (!sector.townId && !hamlet) return []
  const kit = kits[sector.regionId]
  if (!kit) return []
  const anchor = hamlet ?? sector.landmarks.find((l) => l.kind === 'marketplace') ?? { x: 6, y: 4 }
  const reserved = [...sceneryDressing(sector), ...naturalDressing(sector)]
  const candidates = sector.cells
    .filter(
      (cell) =>
        cell.walkable &&
        cell.terrain === '.' &&
        (!sector.townId || cell.safe) &&
        Math.abs(cell.x - anchor.x) + Math.abs(cell.y - anchor.y) <= 7 &&
        reserved.every((prop) => Math.abs(cell.x - prop.x) + Math.abs(cell.y - prop.y) >= 3) &&
        sector.landmarks.every((l) => Math.abs(cell.x - l.x) + Math.abs(cell.y - l.y) >= 2) &&
        !(sector.buildings ?? []).some(
          (b) =>
            cell.x >= b.x - 0.5 &&
            cell.x < b.x + b.width + 0.5 &&
            cell.y >= b.y - 0.5 &&
            cell.y < b.y + b.height + 0.5,
        ),
    )
    .map((cell) => ({ cell, seed: hashString(`${sector.id}:${cell.x}:${cell.y}:working-yard`) }))
    .sort((a, b) => a.seed - b.seed)
  const result: ScenicDressing[] = []
  const count = sector.id === sector.townId ? 3 : hamlet ? 2 : 1
  for (const { cell } of candidates) {
    if (result.some((p) => Math.abs(p.x - cell.x) + Math.abs(p.y - cell.y) < 3)) continue
    const piece = kit[result.length % kit.length]!
    result.push({
      x: cell.x,
      y: cell.y,
      sheet: piece[0],
      index: piece[1],
      scale: piece[0] === 'wild-verges' ? 0.72 : 1.08,
    })
    if (result.length === count) break
  }
  return result
}
