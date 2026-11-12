import type { WorldSectorView } from '@/world/types'
import { hamletFamilyIndex } from './map-dressing'

const townFloors: Readonly<Record<string, number>> = {
  'aureth-crown': 0,
  'verdant-expanse': 1,
  frostmere: 2,
  'starfall-highlands': 3,
  emberreach: 4,
  'glasswind-desert': 5,
  'hollow-coast': 6,
  'umbral-march': 7,
}
/** Material choice only; the existing paving field owns eligible cells. */
export function settlementFloorIndex(sector: WorldSectorView): number | undefined {
  if (sector.warpedTheme || !sector.charted || sector.id.startsWith('ferry:')) return
  if (sector.townId) return townFloors[sector.townId]
  const hamlet = sector.landmarks.find((l) => l.kind === 'hamlet')
  if (!hamlet) return
  const family = hamletFamilyIndex(hamlet.name)
  return family === undefined ? townFloors[sector.regionId] : 8 + family
}
