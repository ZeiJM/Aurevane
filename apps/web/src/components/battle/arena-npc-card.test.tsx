import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'

import { ArenaNpcCard } from './arena-npc-card'

it('renders an empty arena card with identity and fallback portrait only', () => {
  const html = renderToStaticMarkup(
    createElement(ArenaNpcCard, { name: 'Arena Fighter', portraitRef: null, lore: '' }),
  )
  expect(html).toContain('Arena Fighter')
  expect(html).toContain('<img')
  expect(html).not.toMatch(/<details|<summary|<p>/)
})

it('expands long plain text safely without inserting author HTML', () => {
  const html = renderToStaticMarkup(
    createElement(ArenaNpcCard, {
      name: 'Arena Fighter',
      portraitRef: null,
      lore: '<b>Private angle brackets remain text</b> '.repeat(8),
    }),
  )
  expect(html).toContain('<summary>Read arena lore</summary>')
  expect(html).toContain('&lt;b&gt;Private angle brackets remain text&lt;/b&gt;')
  expect(html).not.toContain('<b>')
})
