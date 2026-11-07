'use client'

import {
  PERSONAL_QUEST_GIVERS,
  type PersonalQuestGiverId,
  type PersonalTravelJourney,
} from '@aurevane/game-core/events/persistent-event'
import { WORLD_REGIONS } from '@/world/catalog'

export const initialPersonalJourney: PersonalTravelJourney = {
  type: 'travel-and-report',
  giverId: 'eastern-watch-officer',
  destination: { sectorId: 'verdant-expanse', x: 12, y: 4 },
  offer: '',
  active: '',
  ready: '',
  completed: '',
}

export function PersonalJourneyFields({
  journey,
  change,
}: {
  journey?: PersonalTravelJourney
  change: (next: PersonalTravelJourney | undefined) => void
}) {
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={Boolean(journey)}
          onChange={(event) => change(event.target.checked ? initialPersonalJourney : undefined)}
        />
        Enable a travel and report quest
      </label>
      {journey && (
        <>
          <p>
            The player accepts from the giver, reaches the destination, and returns to report. Each
            character can complete this quest once.
          </p>
          <label>
            Quest giver
            <select
              value={journey.giverId}
              onChange={(event) =>
                change({
                  ...journey,
                  giverId: event.target.value as PersonalQuestGiverId,
                })
              }
            >
              {Object.entries(PERSONAL_QUEST_GIVERS).map(([id, giver]) => (
                <option key={id} value={id}>
                  {giver.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Destination</legend>
            <label>
              Region
              <select
                value={journey.destination.sectorId}
                onChange={(event) =>
                  change({
                    ...journey,
                    destination: { ...journey.destination, sectorId: event.target.value },
                  })
                }
              >
                {WORLD_REGIONS.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
            {(['x', 'y'] as const).map((axis) => (
              <label key={axis}>
                Cell {axis.toUpperCase()}
                <input
                  type="number"
                  min={0}
                  max={axis === 'x' ? 12 : 8}
                  value={journey.destination[axis]}
                  onChange={(event) =>
                    change({
                      ...journey,
                      destination: { ...journey.destination, [axis]: Number(event.target.value) },
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
          {(
            [
              ['offer', 'Offer the quest'],
              ['active', 'Explain where to travel'],
              ['ready', 'Ask for the report'],
              ['completed', 'Confirm completion'],
            ] as const
          ).map(([field, label]) => (
            <label key={field}>
              {label}
              <textarea
                maxLength={800}
                value={journey[field]}
                onChange={(event) => change({ ...journey, [field]: event.target.value })}
              />
            </label>
          ))}
        </>
      )}
    </>
  )
}
