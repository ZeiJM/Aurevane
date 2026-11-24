import { WORLD_MAP_WIDTH } from '@/world/topology'
import type { WorldSector } from '@/world/types'
import { hashString } from '@/world/terrain-gen'

const wrapPublicTreeX = (x: number) => ((x % WORLD_MAP_WIDTH) + WORLD_MAP_WIDTH) % WORLD_MAP_WIDTH

// Saplings and mature crowns share a small set of physical sizes. This also
// lets distant groves reuse their pre-scaled artwork while the camera moves.
const woodlandGrowth = [0.62, 0.73, 0.82, 0.89, 0.95, 1, 1.08, 1.18] as const

/** Constrained trees keep their authored root and never grow into a nearby path. */
export function vegetationPose(
  seed: string,
  x: number,
  y: number,
  anchored: boolean,
  privateScene = false,
) {
  const canonicalX = seed === 'public' ? wrapPublicTreeX(x) : x
  const individual = hashString(`${seed}:${canonicalX}:${y}:growth`)
  const fixed = anchored || privateScene
  return {
    x: fixed ? 0 : ((individual % 997) / 996 - 0.5) * 0.3,
    y: fixed ? 0 : (((individual >>> 10) % 991) / 990 - 0.5) * 0.24,
    scale: woodlandGrowth[(individual >>> 18) % (fixed ? 6 : woodlandGrowth.length)]!,
  }
}

// Source cells in living-trees-v01. The first species is the regional
// signature. Every companion is a tree suited to the same ground.
const mainlandTrees: Readonly<Partial<Record<string, readonly number[]>>> = {
  'aureth-crown': [0, 1, 5, 6],
  'verdant-expanse': [1, 7, 3, 6],
  frostmere: [2, 3],
  'starfall-highlands': [3, 7, 0],
  emberreach: [4, 5, 0],
  'glasswind-desert': [5, 4],
  'hollow-coast': [6, 7, 3],
  'umbral-march': [7, 3, 6],
}

export function mainlandTreeIndex(regionId: string, x: number, y: number, signatureOnly = false) {
  const species = mainlandTrees[regionId]
  if (!species || signatureOnly) return species?.[0]
  const wx = wrapPublicTreeX(x)
  const seed = hashString(`${regionId}:${Math.floor(wx / 2)}:${Math.floor(y / 2)}:species`)
  // Reserve one signature and one companion per small stand. Shuffling which
  // cells they occupy breaks runs of cloned trees without a repeating grid.
  const slot = (wx % 2) + 2 * (y & 1)
  const rank = slot ^ (seed & 3)
  if (rank === 0 || (rank > 1 && ((seed >>> (8 + rank)) & 1) === 0)) return species[0]
  return species[1 + ((seed >>> (4 + slot * 5)) % (species.length - 1))]
}

const groveCompanions = {
  sakura: [1, 7], // elm and alder between the flowering cherries
  autumn: [4, 0], // russet rowan and golden oak among the orange maples
  wisteria: [7, 6], // alder and willow among the hanging purple crowns
  willow: [7, 1],
} as const

export function groveCompanion(landscape: WorldSector['landscape'], x: number, y: number) {
  if (!landscape || landscape === 'wildflowers') return undefined
  const seed = hashString(`${landscape}:${wrapPublicTreeX(x)}:${y}:companion`)
  if ((seed >>> 8) % 3 !== 0) return undefined
  return groveCompanions[landscape][(seed >>> 18) % 2]
}

// Stable individual gust signatures. Some trees never move, while others have
// different flexibility, periods and resting moments; no shared sine wave.
export function treeFlex(region: string, x: number, y: number, species: number) {
  const seed = hashString(region + ':tree:' + x + ':' + y + ':' + species)
  if (seed % 7 === 0 || seed % 13 === 0) return 0
  const shelter = seed % 5 === 0 ? 0.25 : 0.46
  return shelter + ((seed >>> 7) % 83) / 100
}

/** Horizontal canopy shear, with fixed roots; bounded for storm and mobile. */
export function treeWindBend(seed: number, now: number, speed: number, flex: number, quality = 1) {
  if (flex <= 0 || speed === 0 || quality <= 0) return 0
  const phase = (seed % 6283) / 1000
  const sway = (now * Math.PI * 2) / (6200 + ((seed >>> 9) % 4200))
  const gust = (now * Math.PI * 2) / (11_000 + ((seed >>> 15) % 5800))
  const pulse = 0.5 + 0.5 * Math.cos(gust + phase * 0.71)
  const shelter = 0.5 + 0.5 * pulse * pulse
  const oscillation = 0.51 + 0.29 * Math.sin(sway + phase) + 0.13 * Math.sin(gust + phase * 2.1)
  // Amplify gusty weather more than the low speeds used for clear skies and
  // fog. The renderer eases the wind speed when weather changes; a soft cap
  // keeps flexible trees moving smoothly even in the strongest gust.
  const exposure = Math.abs(speed) / 0.065
  const strength = 0.1 + 0.25 * Math.min(exposure, 1)
  const bend = (speed / 0.065) * strength * flex * oscillation * shelter * quality
  return 0.24 * Math.tanh(bend / 0.24)
}

const forestSpecies = {
  haven: [0, 1, 2, 4],
  ashen: [2, 3, 4],
  fracture: [2, 4, 5],
  wayfarer: [0, 1, 4, 5],
  amber: [0, 2, 3, 4],
  amethyst: [0, 1, 2, 5],
} satisfies Record<NonNullable<WorldSector['warpedTheme']>, number[]>

const canopySizes = [
  [2.15, 2.4],
  [2.25, 2.45],
  [1.85, 2.6],
  [2.2, 2.45],
  [1.8, 2.65],
  [1.9, 2.65],
] as const

/** Authored foliage tiles remain walkable, including in visual clearings. */
export function forestCanopy(
  sectorId: string,
  x: number,
  y: number,
  theme: NonNullable<WorldSector['warpedTheme']>,
) {
  const seed = hashString(`${sectorId}:${x}:${y}:canopy`)
  const clearing = hashString(`${sectorId}:${Math.floor(x / 3)}:${Math.floor(y / 3)}:clearing`)
  const species = forestSpecies[theme]
  const index = species[(seed >>> 8) % species.length]!
  const [width, height] = canopySizes[index]!
  return {
    visible: seed % 100 < (clearing % 5 === 0 ? 47 : 74),
    index,
    x: (((seed >>> 13) % 85) / 84 - 0.5) * 0.46,
    y: (((seed >>> 20) % 91) / 90 - 0.5) * 0.38,
    scale: 0.73 + ((seed >>> 17) % 100) * 0.003,
    placement: {
      width,
      height,
      anchorX: 0.5,
      anchorY: 306 / 320,
      source: [(index % 3) / 3, Math.floor(index / 3) / 2, 1 / 3, 1 / 2] as const,
    },
  }
}
