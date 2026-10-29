import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { WorldEnvironmentEditor } from './world-environment-editor'
import { DEFAULT_WORLD_ENVIRONMENT_SETTINGS } from '@/world/environment'
it('shows real cycle controls and regional weather without reasons or history/version chores', () => {
  const html = renderToStaticMarkup(
    <WorldEnvironmentEditor
      initialSettings={{
        ...DEFAULT_WORLD_ENVIRONMENT_SETTINGS,
        version: 5,
        dayLengthMinutes: 120,
        frozenMinuteOfDay: 1080,
        weatherOverride: 'storm',
      }}
      initialNowMs={Date.UTC(2026, 9, 10, 3)}
    />,
  )
  for (const text of [
    'Day length (real minutes)',
    'Automatic weather roll interval (real minutes)',
    'Snowstorm in Frostmere',
    'Save Changes',
    '18:00',
    'Keep current weather',
  ])
    expect(html).toContain(text)
  expect(html).not.toMatch(/Recent changes|change reason|environment v5|Until cleared<\/option>/)
  expect(html).toContain('type="number"')
  expect(html).toContain('value="120"')
})

it('separates automatic roll cadence and shows local expiry with remaining time', () => {
  const now = Date.UTC(2026, 9, 26, 12)
  const html = renderToStaticMarkup(
    <WorldEnvironmentEditor
      initialNowMs={now}
      initialSettings={{
        ...DEFAULT_WORLD_ENVIRONMENT_SETTINGS,
        weatherRollMinutes: 15,
        weatherOverride: 'rain',
        weatherOverrideUntil: now + 37 * 60_000,
      }}
    />,
  )
  expect(html).toContain('Automatic weather roll interval (real minutes)')
  expect(html).toContain('value="15"')
  expect(html).toContain('37 min remaining')
  expect(html).toContain('local time')
  expect(html).not.toContain('2026-10-26T')
})

it('uses one timing control and explains when a manual selection ends', () => {
  const html = renderToStaticMarkup(
    <WorldEnvironmentEditor
      initialSettings={DEFAULT_WORLD_ENVIRONMENT_SETTINGS}
      initialNowMs={Date.UTC(2026, 9, 27, 12)}
    />,
  )
  expect(html).not.toContain('Forced weather duration')
  expect(html).toContain('Manual selections last until the next automatic roll.')
  expect(html).toContain('<option value="unchanged" selected="">Keep current weather</option>')
})
