'use client'

import type { EventRecurrence } from '@aurevane/game-core/events/persistent-event'

export function EventRecurrenceField({
  policy,
  setPolicy,
  rollingLabel,
}: {
  policy: EventRecurrence
  setPolicy: (next: EventRecurrence) => void
  rollingLabel: string
}) {
  const calendar = policy.mode !== 'rolling-24h' ? policy : undefined
  return (
    <fieldset>
      <legend>Next availability</legend>
      <label>
        Recurrence
        <select
          aria-label="Recurrence"
          value={policy.mode}
          onChange={(event) => {
            const mode = event.target.value
            if (mode === 'rolling-24h') setPolicy({ mode })
            else if (mode === 'calendar-day' || mode === 'calendar-week') {
              setPolicy({
                mode,
                timeZone: calendar?.timeZone ?? 'UTC',
                resetMinute: calendar?.resetMinute ?? 0,
              })
            }
          }}
        >
          <option value="rolling-24h">{rollingLabel}</option>
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
  )
}
