import { WORLD_MAP_WIDTH } from '@/world/topology'
import type { WorldSector } from '@/world/types'
import { hashString } from '@/world/terrain-gen'

const wrapPublicTreeX = (x: number) => ((x % WORLD_MAP_WIDTH) + WORLD_MAP_WIDTH) % WORLD_MAP_WIDTH

/** Cosmetic growth only; offsets stay within the supplied tree cell. */
export function vegetationPose(
  seed: string,
  x: number,
  y: number,
  anchored: boolean,
  privateScene = false,
) {
  if (anchored) return { x: 0, y: 0, scale: 1 }
  // Camera wrapping changes drawing coordinates, never a public tree's identity.
  const canonicalX = seed === 'public' ? wrapPublicTreeX(x) : x
  const individual = hashString(`${seed}:${canonicalX}:${y}:growth`)
  const grove = hashString(`${seed}:${Math.floor(canonicalX / 3)}:${Math.floor(y / 3)}:grove`)
  return {
    x: privateScene ? 0 : ((individual % 997) / 996 - 0.5) * 0.3,
    y: privateScene ? 0 : (((individual >>> 10) % 991) / 990 - 0.5) * 0.24,
    scale: Math.min(
      privateScene ? 1 : 1.18,
      0.78 + ((grove % 101) / 100) * 0.24 + (((individual >>> 20) % 101) / 100) * 0.16,
    ),
  }
}

// Source cells in living-trees-v01. Each region keeps its signature tree as
// the most common silhouette and mixes in species suited to the same ground.
const mainlandTrees: Readonly<Partial<Record<string, readonly [number, ...number[]]>>> = {
  'aureth-crown': [0, 0, 1, 5, 6],
  'verdant-expanse': [1, 1, 7, 3, 6],
  frostmere: [2, 2, 2, 3],
  'starfall-highlands': [3, 3, 7, 0],
  emberreach: [4, 4, 5, 0],
  'glasswind-desert': [5, 5, 4],
  'hollow-coast': [6, 6, 7, 3],
  'umbral-march': [7, 7, 3, 6],
}

export function mainlandTreeIndex(regionId: string, x: number, y: number, anchored: boolean) {
  const species = mainlandTrees[regionId]
  if (!species || anchored) return species?.[0]
  const seed = hashString(`${regionId}:${wrapPublicTreeX(x)}:${y}:species`)
  return species[(seed >>> 10) % species.length]
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
