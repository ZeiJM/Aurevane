import { wrappedMapX } from '@/world/topology'
import { MAP_X, MAP_Y } from './map-projection'
import { GRAND_BRIDGE_BASE_CONTACTS } from './map-surface-art'
import type { MapPoint } from './world-motion'

// Painted tread centre sampled from the far bank to the near bank at quarter
// spans. Coordinates use a 512-unit square for each source crop, including props.
const profiles = {
  footbridge: { farX: 415, nearX: 91, tread: [145, 158, 195, 273, 404], halfWidth: 49 },
  timber: { farX: 425, nearX: 107, tread: [123, 153, 195, 247, 310], halfWidth: 23 },
  stone: { farX: 425, nearX: 107, tread: [112, 147, 190, 239, 303], halfWidth: 24 },
  causeway: {
    farX: GRAND_BRIDGE_BASE_CONTACTS[0].x * 512,
    nearX: GRAND_BRIDGE_BASE_CONTACTS[1].x * 512,
    tread: [
      GRAND_BRIDGE_BASE_CONTACTS[0].y * 512,
      198,
      247,
      304,
      GRAND_BRIDGE_BASE_CONTACTS[1].y * 512,
    ],
    halfWidth: 26,
  },
} as const
type DeckProfile = keyof typeof profiles
export interface BridgeDeck {
  point: MapPoint
  along: 'x' | 'y'
  span: number
  profile: DeckProfile
  left: number
  right: number
}

export function bridgeDeckArt(span: number, kind: DeckProfile) {
  const { farX, nearX, tread } = profiles[kind]
  return {
    width: (span * MAP_X * 512) / (farX - nearX),
    height: (span * MAP_Y * 512) / (tread[4] - tread[0]),
    anchorX: (farX + nearX) / 1024,
    anchorY: (tread[0] + tread[4]) / 1024,
  }
}

/** The same four tread segments project feet and invert clicks on the painted planks. */
export function bridgeDeckPoint(
  deck: BridgeDeck,
  point: MapPoint,
  inverse = false,
): MapPoint | null {
  const { along, span, left, right } = deck
  const across = along === 'x' ? 'y' : 'x'
  const dx = wrappedMapX(point.x, deck.point.x) - deck.point.x
  const dy = point.y - deck.point.y
  const distance = along === 'x' ? dx : dy
  const lateral = along === 'x' ? dy : dx
  const progress = distance / span + 0.5
  if (progress < 0 || progress > 1) return null
  const { tread, halfWidth } = profiles[deck.profile]
  const rise = tread[4] - tread[0]
  const liftAt = (index: number) => (index / 4 - (tread[index]! - tread[0]) / rise) / 2
  let segment = 0
  while (segment < 3 && progress > (segment + 1) / 4 - (inverse ? liftAt(segment + 1) : 0))
    segment++
  const startLift = liftAt(segment)
  const endLift = liftAt(segment + 1)
  const blend =
    (progress - segment / 4 + (inverse ? startLift : 0)) /
    (0.25 - (inverse ? endLift - startLift : 0))
  const t = (segment + blend) / 4
  // Raising a foot vertically on an isometric map subtracts the same amount
  // from both ground axes. Taper several legal lanes onto the width of the art.
  const lift = (startLift + (endLift - startLift) * blend) * span
  const halfDeck = (halfWidth * span) / (2 * rise)
  const approach = Math.min(1, 4 * t, 4 * (1 - t))
  const side = (inverse ? lateral + lift : lateral) < 0 ? left : right
  const widthScale = 1 - approach * (1 - Math.min(1, halfDeck / side))
  const lane = inverse ? (lateral + lift) / widthScale : lateral
  if (lane < -left || lane > right) return null
  const result = { ...point }
  result[along] += inverse ? lift : -lift
  result[across] += inverse ? lane - lateral : lane * (widthScale - 1) - lift
  return result
}
