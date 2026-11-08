import { hashString } from '@/world/terrain-gen'
import type { WorldBuilding, WorldSectorView } from '@/world/types'

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

export const warpedPalette = {
  haven: 'rgba(120,153,104,.20)',
  ashen: 'rgba(56,45,60,.38)',
  fracture: 'rgba(109,88,165,.29)',
  wayfarer: 'rgba(135,127,90,.15)',
  amber: 'rgba(159,80,61,.25)',
  amethyst: 'rgba(143,93,163,.29)',
} satisfies Record<NonNullable<WorldSectorView['warpedTheme']>, string>
