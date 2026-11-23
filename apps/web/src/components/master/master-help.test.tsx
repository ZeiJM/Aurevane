import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { MasterHelp } from './master-help'
it('keeps help behind a named dialog button rather than an always-visible paragraph', () => {
  const html = renderToStaticMarkup(
    <MasterHelp label="Weather interval">Weather rolls may select the same weather.</MasterHelp>,
  )
  expect(html).toContain('aria-label="About Weather interval"')
  expect(html).toContain('aria-haspopup="dialog"')
  expect(html).toContain('<dialog')
  expect(html).not.toContain('<dialog open')
  expect(html).toContain('Weather rolls may select the same weather.')
})
