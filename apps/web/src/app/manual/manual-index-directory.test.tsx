import type { Route } from 'next'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/components/media/aurevane-image', () => ({
  AurevaneImage: ({ assetId }: { assetId: string }) =>
    createElement('img', { 'data-art': assetId, alt: '' }),
}))
import { ManualIndexDirectory } from './manual-index-directory'
describe('Manual collection and detail', () => {
  it('keeps search and every guide link while presenting a real selected guide', () => {
    const markup = renderToStaticMarkup(
      createElement(ManualIndexDirectory, {
        entries: [
          {
            id: 'combat',
            href: '/manual/combat' as Route,
            title: 'Combat',
            category: 'Combat',
            summary: 'Current authoritative combat guide.',
            lastUpdated: '2026-09-30',
            assetId: 'environment.battle-hall.courtyard',
          },
          {
            id: 'training',
            href: '/manual/training' as Route,
            title: 'Passive Training',
            category: 'Progression',
            summary: 'Server-timed progress.',
            lastUpdated: '2026-09-30',
            assetId: 'environment.passive-training.cloister',
          },
        ],
      }),
    )
    for (const text of [
      'aria-label="Search the Manual"',
      'href="/manual/combat"',
      'href="/manual/training"',
      'aria-label="Selected guide"',
      'Current authoritative combat guide.',
      'Read this guide',
    ])
      expect(markup).toContain(text)
    expect(markup).not.toContain('The Verdant Expanse')
  })
})
