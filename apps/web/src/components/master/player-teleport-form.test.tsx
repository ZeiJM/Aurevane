import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { PlayerTeleportForm } from './player-teleport-form'
it('offers mainland or current Void with bounded sector and local coordinate fields', () => {
  const html = renderToStaticMarkup(
    createElement(PlayerTeleportForm, { disabled: false, onReview: () => {} }),
  )
  expect(html).toContain('Current Void')
  expect(html).toContain('Mainland')
  expect(html).toContain('Sector number')
  expect(html).toContain('max="8192"')
  expect(html).toContain('max="12"')
  expect(html).toContain('max="8"')
  expect(html).toContain('Staff reason')
  expect(html).toContain('maxLength="240"')
  expect(html).toContain('Review teleport')
  expect(html).not.toContain('<form')
})
