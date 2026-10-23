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
    'Forced weather duration (minutes)',
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
