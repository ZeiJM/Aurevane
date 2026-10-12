import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }))

import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { WorldWorkspace } from './world-workspace'

describe('World page', () => {
  it('renders the native map with contextual panel and location navigation', () => {
    const markup = renderToStaticMarkup(
      createElement(WorldWorkspace, {
        initialView: projectWorld(newWorldState(), [], 1000),
        character: { name: 'Traveller', portrait: '/portrait.webp' },
      }),
    )
    expect(markup).toContain('data-world-workspace')
    expect(markup).toContain('<canvas')
    expect(markup).not.toContain('<iframe')
    expect(markup).toContain('World map. Click ground')
    expect(markup).toContain('Nearby characters')
    expect(markup).toContain('Open world atlas')
    expect(markup).toContain('data-world-travel-status')
    expect(markup).not.toContain('Journal')
    expect(markup).not.toContain('Weathered Observatory')
  })
})
