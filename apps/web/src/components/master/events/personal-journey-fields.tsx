'use client'

import {
  PERSONAL_QUEST_GIVERS,
  type PersonalItemExchange,
  type PersonalJourney,
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

function toExchange(journey: PersonalTravelJourney): PersonalItemExchange {
  return {
    type: 'item-exchange',
    giverId: journey.giverId,
    inputItemId: '',
    inputQuantity: 1,
    outputItemId: '',
    offer: journey.offer,
    active: journey.active,
    ready: journey.ready,
    completed: journey.completed,
  }
}

function toTravel(journey: PersonalItemExchange): PersonalTravelJourney {
  return {
    ...initialPersonalJourney,
    giverId: journey.giverId,
    offer: journey.offer,
    active: journey.active,
    ready: journey.ready,
    completed: journey.completed,
  }
}

export function PersonalJourneyFields({
  journey,
  change,
}: {
  journey?: PersonalJourney
  change: (next: PersonalJourney | undefined) => void
}) {
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={Boolean(journey)}
          onChange={(event) => change(event.target.checked ? initialPersonalJourney : undefined)}
        />
        Enable a personal quest
      </label>
      {journey && (
        <>
          <label>
            Quest type
            <select
              value={journey.type}
              onChange={(event) => {
                if (event.target.value === journey.type) return
                change(
                  journey.type === 'travel-and-report' ? toExchange(journey) : toTravel(journey),
                )
              }}
            >
              <option value="travel-and-report">Travel and report</option>
              <option value="item-exchange">Hand in items</option>
            </select>
          </label>
          <p>
            {journey.type === 'travel-and-report'
              ? 'The player accepts, reaches the destination, and returns to report.'
              : 'The player accepts, hands over carried items, and earns an item and access.'}{' '}
            Each character can complete this quest once.
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
          {journey.type === 'travel-and-report' ? (
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
          ) : (
            <fieldset>
              <legend>Item exchange</legend>
              <p>Use the IDs of enabled Items from Game Content.</p>
              <label>
                Item to hand in
                <input
                  value={journey.inputItemId}
                  maxLength={160}
                  onChange={(event) => change({ ...journey, inputItemId: event.target.value })}
                />
              </label>
              <label>
                Quantity to hand in
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={journey.inputQuantity}
                  onChange={(event) =>
                    change({ ...journey, inputQuantity: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Item to receive
                <input
                  value={journey.outputItemId}
                  maxLength={160}
                  onChange={(event) => change({ ...journey, outputItemId: event.target.value })}
                />
              </label>
            </fieldset>
          )}
          {(
            [
              ['offer', 'Offer the quest'],
              [
                'active',
                journey.type === 'travel-and-report'
                  ? 'Explain where to travel'
                  : 'Explain which items to bring',
              ],
              [
                'ready',
                journey.type === 'travel-and-report' ? 'Ask for the report' : 'Ask for the items',
              ],
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
