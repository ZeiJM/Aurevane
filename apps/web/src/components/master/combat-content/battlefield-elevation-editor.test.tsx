import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { BattlefieldElevationEditor } from './battlefield-elevation-editor'
it('renders three exact chances with a new battle warning and reason-free save', () => {
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
    'Save Changes',
    'new battles',
  ])
    expect(html).toContain(label)
  expect(html).toContain('value="12.34"')
  expect(html).toContain('step="0.01"')
  expect(html).not.toContain('disabled=""')
  expect(html).not.toMatch(/change reason|policy v7|chances v7/)
  expect(html).toContain('Target Elevation')
  expect(html).not.toContain('Total:')
})

it('enables an independent non-100 total and explains the highest-success rule', () => {
  const html = renderToStaticMarkup(
    <BattlefieldElevationEditor
      initialPolicy={{
        version: 2,
        model: 'independent-highest',
        level1BasisPoints: 10000,
        level2BasisPoints: 10000,
        level3BasisPoints: 0,
      }}
    />,
  )
  expect(html).not.toContain('disabled=""')
  expect(html).not.toContain('Total:')
  expect(html).toContain('highest successful level')
  expect(html).toContain('none succeeds')
})
