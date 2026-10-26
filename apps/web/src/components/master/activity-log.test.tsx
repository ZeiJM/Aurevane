import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { MasterActivityLog } from './activity-log'

const feed = {
  entries: [],
  weekStartsAt: '2026-10-26T00:00:00Z',
  resetsAt: '2026-11-02T00:00:00Z',
  nextCursor: null,
}
it('shows a compact readable weekly feed, an empty state, and bounded pagination', () => {
  const empty = renderToStaticMarkup(createElement(MasterActivityLog, { initialFeed: feed }))
  expect(empty).toContain('No changes recorded this week.')
  expect(empty).toContain('Monday at 00:00 UTC')
  expect(empty).not.toMatch(/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<dialog/u)
  const populated = renderToStaticMarkup(
    createElement(MasterActivityLog, {
      initialFeed: {
        ...feed,
        entries: [
          {
            id: '37',
            occurredAt: '2026-10-26T06:00:00Z',
            actor: 'Mira',
            action: 'Published content',
            subject: 'Ember',
            detail: 'Changed: Name',
          },
        ],
        nextCursor: '37',
      },
    }),
  )
  for (const value of [
    'Mira',
    'Published content',
    'Ember',
    'Changed: Name',
    'Load earlier',
    'Refresh',
  ])
    expect(populated).toContain(value)
  expect(populated).not.toContain('<textarea')
  expect(populated).not.toContain('>37<')
  expect(populated).toMatch(/<time[^>]*>[^<]* UTC<\/time>/u)
})
