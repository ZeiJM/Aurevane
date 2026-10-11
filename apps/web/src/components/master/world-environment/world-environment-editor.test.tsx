import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { WorldEnvironmentEditor } from './world-environment-editor'

const settings = {
  version: 5,
  timeOffsetMinutes: 0,
  frozenMinuteOfDay: 1080,
  weatherOverride: 'storm' as const,
  weatherOverrideUntil: null,
}

it('shows effective time and weather, every control, a required reason and the history', () => {
  const html = renderToStaticMarkup(
    <WorldEnvironmentEditor
      initialSettings={settings}
      initialNowMs={Date.UTC(2026, 9, 10, 3)}
      initialHistory={[
        {
          id: 9,
          version: 5,
          actorUserId: 'owner-1',
          reason: 'Evening storm for the event',
          before: {},
          after: {
            timeOffsetMinutes: 0,
            frozenMinuteOfDay: 1080,
            weatherOverride: 'storm',
            weatherOverrideUntilMs: null,
          },
          changedAtMs: Date.UTC(2026, 9, 10),
        },
      ]}
    />,
  )
  for (const text of [
    'World environment v5',
    'Effective server time 18:00 UTC (frozen); weather storm (forced by Master).',
    'Shift server time (minutes',
    'Freeze the clock at a time of day',
    'Force fog',
    '15 minutes',
    'Until cleared',
    'Live weather (no override)',
    'Environment change reason',
    'Apply world environment',
    'Recent changes',
    'clock frozen at 18:00 UTC; weather forced to storm until cleared',
    'Evening storm for the event',
  ])
    expect(html).toContain(text)
  expect(html).toContain('required')
  expect(html).toContain('disabled=""')
})
it('explains an empty history', () => {
  const html = renderToStaticMarkup(
    <WorldEnvironmentEditor
      initialSettings={{ ...settings, version: 0, frozenMinuteOfDay: null, weatherOverride: null }}
      initialHistory={[]}
      initialNowMs={Date.UTC(2026, 9, 10, 3)}
    />,
  )
  expect(html).toContain('No environment changes have been recorded.')
  expect(html).toContain('weather ')
  expect(html).toContain('(live)')
})
