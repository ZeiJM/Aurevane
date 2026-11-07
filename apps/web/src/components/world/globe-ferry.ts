import { projectWorldFerries } from '@/world/ferry'
import type { GlobeLocation } from '@/world/globe-math'
import { UNCHARTED_VEIL_FOCUS } from './globe-veil'

/** A chart approximation only. Never takes or exposes a private dock coordinate. */
export function globeFerryPosition(now: number, dock: GlobeLocation): GlobeLocation | null {
  const passage = projectWorldFerries(now)[0]
  if (!passage) return null
  const fraction = (now - passage.departureAt) / (passage.arrivalAt - passage.departureAt)
  const distance = passage.direction === 'outbound' ? fraction : 1 - fraction
  // The hull is no longer visible once it passes under the uncharted veil.
  if (distance > 0.75) return null
  const delta = ((UNCHARTED_VEIL_FOCUS.longitude - dock.longitude + 540) % 360) - 180
  return {
    longitude: ((dock.longitude + distance * delta + 540) % 360) - 180,
    latitude: dock.latitude + (UNCHARTED_VEIL_FOCUS.latitude - dock.latitude) * distance,
  }
}
