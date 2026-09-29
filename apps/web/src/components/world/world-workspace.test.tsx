import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }))

import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { WorldWorkspace } from './world-workspace'

describe('Atlas location presentation', () => {
  it('names the actual location separately from the inspected location and offers selection before travel', () => {
    const markup = renderToStaticMarkup(
      createElement(WorldWorkspace, {
        initialView: projectWorld(newWorldState(), [], 1000),
        character: { name: 'Traveller', portrait: '/portrait.webp' },
      }),
    )
    expect(markup).toContain('You are in')
    expect(markup).toContain('Viewing')
    expect(markup).toContain('Select a square to inspect it')
    expect(markup).toContain('aria-label="Location details"')
    expect(markup).not.toContain('Weathered Observatory')
  })
})
