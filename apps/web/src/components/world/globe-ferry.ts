import { projectWorldFerries } from '@/world/ferry'
import type { GlobeLocation } from '@/world/globe-math'
// This illustrated harbor marks the ferry service on the same public chart as
// the Uncharted Lands cover. The live landing moves and remains private.
export const UNCHARTED_FERRY_CHART_LOCATION = { longitude: 163, latitude: -5.5 } as const

/** A chart approximation only. Never takes or exposes a private dock coordinate. */
export function globeFerryPosition(
  now: number,
  dock: GlobeLocation,
  remote?: GlobeLocation,
): GlobeLocation | null {
  const passage = projectWorldFerries(now).find(
    ({ direction }) => direction.startsWith('asterwake-') === !!remote,
  )
  if (!passage) return null
  const fraction = (now - passage.departureAt) / (passage.arrivalAt - passage.departureAt)
  const distance = passage.direction.endsWith('outbound') ? fraction : 1 - fraction
  // The hull is no longer visible once it passes under the uncharted veil.
  if (!remote && distance > 0.75) return null
  const destination = remote ?? UNCHARTED_FERRY_CHART_LOCATION
  const delta = ((destination.longitude - dock.longitude + 540) % 360) - 180
  return {
    longitude: ((dock.longitude + distance * delta + 540) % 360) - 180,
    latitude: dock.latitude + (destination.latitude - dock.latitude) * distance,
  }
}
