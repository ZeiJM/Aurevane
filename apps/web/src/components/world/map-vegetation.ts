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
