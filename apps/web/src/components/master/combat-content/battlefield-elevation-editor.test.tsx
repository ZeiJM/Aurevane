import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { BattlefieldElevationEditor } from './battlefield-elevation-editor'
it('renders three exact chances with a new battle warning and reason-gated publish', () => {
  const html = renderToStaticMarkup(
    <BattlefieldElevationEditor
      initialPolicy={{
        version: 7,
        level1BasisPoints: 1234,
        level2BasisPoints: 8766,
        level3BasisPoints: 0,
      }}
    />,
  )
  for (const label of [
    'Elevation level 1 chance (%)',
    'Elevation level 2 chance (%)',
    'Elevation level 3 chance (%)',
    'Elevation change reason',
    'Publish elevation chances',
    'Total: 100%',
    'new battles',
  ])
    expect(html).toContain(label)
  expect(html).toContain('value="12.34"')
  expect(html).toContain('step="0.01"')
  expect(html).toContain('disabled=""')
})
