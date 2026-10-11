import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }))

import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { WorldWorkspace } from './world-workspace'

describe('World page', () => {
  it('renders the scenic map stage as a same-origin frame with travel status and Journal control', () => {
    const markup = renderToStaticMarkup(
      createElement(WorldWorkspace, {
        initialView: projectWorld(newWorldState(), [], 1000),
        character: { name: 'Traveller', portrait: '/portrait.webp' },
      }),
    )
    expect(markup).toContain('data-world-workspace')
    expect(markup).toContain('src="/world-stage/index.html"')
    expect(markup).toContain('title="World map"')
    expect(markup).toContain('data-world-travel-status')
    expect(markup).toContain('Journal')
    expect(markup).not.toContain('Weathered Observatory')
  })
})
