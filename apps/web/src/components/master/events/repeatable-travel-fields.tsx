'use client'

import type { EventRecurrence, RepeatableTravel } from '@aurevane/game-core/events/persistent-event'
import { PersonalJourneyFields } from './personal-journey-fields'

export function RepeatableTravelFields({
  value,
  change,
}: {
  value?: RepeatableTravel
  change: (next: RepeatableTravel | undefined) => void
}) {
  const policy = value?.recurrence
  const setPolicy = (recurrence: EventRecurrence) => {
    if (value) change({ ...value, recurrence })
  }
  const calendar = policy?.mode !== 'rolling-24h' ? policy : undefined
  return (
    <>
      <PersonalJourneyFields
        journey={value?.journey}
        storyNpcs={[]}
        repeatable
        change={(journey) =>
          change(
            journey?.type === 'travel-and-report'
              ? { journey, recurrence: policy ?? { mode: 'rolling-24h' } }
              : undefined,
          )
        }
      />
      {value && policy && (
        <fieldset>
          <legend>Next availability</legend>
          <label>
            Recurrence
            <select
              value={policy.mode}
              onChange={(event) => {
                const mode = event.target.value
                if (mode === 'rolling-24h') setPolicy({ mode })
                else if (mode === 'calendar-day' || mode === 'calendar-week') {
                  setPolicy({
                    mode,
                    timeZone: calendar?.timeZone ?? '',
                    resetMinute: calendar?.resetMinute ?? 0,
                  })
                }
              }}
            >
              <option value="rolling-24h">24 hours after reporting</option>
              <option value="calendar-day">Next calendar day reset</option>
              <option value="calendar-week">Next Monday reset</option>
            </select>
          </label>
          {calendar && (
            <>
              <label>
                Calendar timezone
                <input
                  value={calendar.timeZone}
                  placeholder="Area/City"
                  onChange={(event) => setPolicy({ ...calendar, timeZone: event.target.value })}
                />
              </label>
              <label>
                Local reset time
                <input
                  type="time"
                  value={`${Math.floor(calendar.resetMinute / 60)
                    .toString()
                    .padStart(2, '0')}:${(calendar.resetMinute % 60).toString().padStart(2, '0')}`}
                  onChange={(event) => {
                    const [hours, minutes] = event.target.value.split(':').map(Number)
                    if (hours !== undefined && minutes !== undefined)
                      setPolicy({ ...calendar, resetMinute: hours * 60 + minutes })
                  }}
                />
              </label>
            </>
          )}
        </fieldset>
      )}
    </>
  )
}
