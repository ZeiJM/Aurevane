import { hashString } from '@/world/terrain-gen'
import type { WorldBuilding, WorldSectorView } from '@/world/types'

// Measured opaque floor contacts in the original runtime sheets. Cells whose
// artwork reaches the crop edge keep their existing pivot; empty padding in the
// remaining cells must not lift the object above its authored ground point.
const legacyContacts: Record<string, Partial<Record<number, readonly [number, number]>>> = {
  buildings: { 1: [0.508, 0.935], 6: [0.541, 0.907], 7: [0.593, 0.9], 8: [0.625, 0.895] },
  props: {
    1: [0.597, 0.899],
    4: [0.56, 0.898],
    5: [0.556, 0.837],
    6: [0.667, 0.894],
    7: [0.632, 0.912],
  },
}
export const legacyStructureContact = (sheet: 'buildings' | 'props', index: number) =>
  legacyContacts[sheet]![index]

const settlementArt: Readonly<Record<string, number>> = {
  'aureth-crown': 0,
  'verdant-expanse': 1,
  'hollow-coast': 2,
  emberreach: 3,
  'glasswind-desert': 4,
  'starfall-highlands': 5,
  'umbral-march': 6,
}

/** Landmarks establish a regional silhouette. Nearby buildings mix old and new forms. */
export function regionalBuildingIndex(sector: WorldSectorView, building: WorldBuilding) {
  if (
    !sector.charted ||
    !sector.townId ||
    building.propIndex !== undefined ||
    building.artIndex === 8
  )
    return
  if (sector.id === sector.townId ? building.x === 4 : hashString(building.id) % 5 === 0)
    return settlementArt[sector.townId]
}

export const WORLD_STRUCTURE_ASPECT = 336 / 384
export const WORLD_STRUCTURE_FLOOR = 313 / 336

export type Chimney = readonly [x: number, y: number, exposure: number]

// Flue openings measured in their 384 × 336 source cells. Buildings with no
// working flue, including the abandoned Void ruins, never emit smoke.
export const winterChimneys: Readonly<Partial<Record<number, Chimney>>> = {
  1: [222, 96, 0.8],
}

export const settlementChimneys: Readonly<Partial<Record<number, Chimney>>> = {
  1: [230, 21, 0.72], // mill
  2: [226, 16, 1], // coastal tavern
  3: [186, 27, 0.8], // forge
  6: [227, 59, 0.58], // woodland lodge
}

export const warpedChimneys: Readonly<Partial<Record<number, Chimney>>> = {
  7: [236, 18, 0.74], // Lantern Refuge
  11: [297, 45, 0.55], // Sporelight Homes
}

export const townPaving: Readonly<Record<string, { color: string; glaze: string }>> = {
  'aureth-crown': { color: '#ad9b79', glaze: 'rgba(208,189,146,.30)' },
  'verdant-expanse': { color: '#747759', glaze: 'rgba(91,112,64,.33)' },
  'hollow-coast': { color: '#758784', glaze: 'rgba(96,127,122,.39)' },
  emberreach: { color: '#5a4d49', glaze: 'rgba(66,46,50,.53)' },
  'glasswind-desert': { color: '#aa8d60', glaze: 'rgba(184,145,80,.41)' },
  'starfall-highlands': { color: '#83808a', glaze: 'rgba(106,100,137,.39)' },
  'umbral-march': { color: '#657067', glaze: 'rgba(53,73,66,.41)' },
}

// Strong material glazes make private ground visibly alien, including white and yellow.
export const warpedPalette = {
  haven: '#e5f1cb',
  ashen: '#eeeaf5',
  fracture: '#e6d451',
  wayfarer: '#a8dfd4',
  amber: '#e9bc48',
  amethyst: '#b184d6',
} satisfies Record<NonNullable<WorldSectorView['warpedTheme']>, string>
