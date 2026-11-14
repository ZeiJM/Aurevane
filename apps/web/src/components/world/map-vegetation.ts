import { WORLD_MAP_WIDTH } from '@/world/topology'
import { hashString } from '@/world/terrain-gen'

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
  const canonicalX =
    seed === 'public' ? ((x % WORLD_MAP_WIDTH) + WORLD_MAP_WIDTH) % WORLD_MAP_WIDTH : x
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
  const period = 1700 + ((seed >>> 9) % 3800)
  const gustPeriod = 3300 + ((seed >>> 15) % 4200)
  const oscillation =
    0.68 + 0.22 * Math.sin(now / period + phase) + 0.1 * Math.sin(now / gustPeriod + phase * 2.1)
  const pause = Math.sin(now / (period * 2.9) + phase * 0.71) > 0.86 ? 0.18 : 1
  return Math.max(
    -0.11,
    Math.min(0.11, (speed / 0.065) * 0.085 * flex * oscillation * pause * quality),
  )
}
