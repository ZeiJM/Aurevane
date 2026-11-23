import 'server-only'
import type { WorldArchiveEntry, WorldState } from '@/world/types'
import { SURVEY_SECTOR } from './world-content'
import { warpedFieldObservations } from './warped-continent'

const firstObservation = SURVEY_SECTOR.landmarks[0]!
export const FIRST_FIELD_OBSERVATION_ID = firstObservation.id

export function worldArchiveEntries(state: WorldState): WorldArchiveEntry[] {
  const warped = warpedFieldObservations(state)
  if (!state.completedObjectives.includes(FIRST_FIELD_OBSERVATION_ID)) return warped

  return [
    {
      id: `field-observation-${FIRST_FIELD_OBSERVATION_ID}`,
      kind: 'field-observation',
      title: firstObservation.name,
      location: SURVEY_SECTOR.name,
      summary: 'The site was verified by direct field observation beyond the last reliable map.',
      provenance: 'Direct field observation',
    },
    ...warped,
  ]
}
