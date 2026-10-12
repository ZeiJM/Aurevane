import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }))

import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { WorldWorkspace } from './world-workspace'

describe('World page', () => {
  it('shows persistent training blocking in an alert and clears it with authoritative release', () => {
    const view = projectWorld(newWorldState(), [], 1000)
    const render = () =>
      renderToStaticMarkup(
        createElement(WorldWorkspace, {
          initialView: view,
          character: { name: 'Traveller', portrait: '/portrait.webp' },
        }),
      )
    view.movementBlocked = 'Stop Passive Training to travel.'
    const blocked = render()
    expect(blocked).toContain('role="alert"')
    expect(blocked).toContain('Stop Passive Training to travel.')
    expect(blocked).not.toContain('Dismiss message')
    expect(blocked).not.toContain('data-world-travel-status')
    expect(blocked).not.toContain('Stop travel')
    view.movementBlocked = null
    const released = render()
    expect(released).not.toContain('role="alert"')
    expect(released).not.toContain('Stop Passive Training to travel.')
  })
  it('renders the native map with contextual panel and location navigation', () => {
    const view = projectWorld(newWorldState(), [], 1000)
    view.sectors = view.sectors.map((sector) => ({ ...sector, panorama: '/panorama.webp' }))
    const markup = renderToStaticMarkup(
      createElement(WorldWorkspace, {
        initialView: view,
        character: { name: 'Traveller', portrait: '/portrait.webp' },
      }),
    )
    expect(markup).toContain('data-world-workspace')
    expect(markup).toContain('<canvas')
    expect(markup).not.toContain('<iframe')
    expect(markup).toContain('World map. Click ground')
    expect(markup).toContain('0 visible players')
    expect(markup).not.toContain('Nearby characters')
    expect(markup).not.toContain('YOUR POSITION')
    expect(markup).not.toContain('LOCAL MAP')
    expect(markup).not.toContain('Known paths, new stories')
    expect(markup).not.toContain('<footer')
    expect(markup).toContain('aria-label="Map settings"')
    expect(markup).toContain('<svg')
    expect(markup).toContain('Open world atlas')
    expect(markup).not.toContain('data-world-travel-status')
    expect(markup).not.toContain('Stop travel')
    expect(markup).not.toContain('Journal')
    expect(markup).not.toContain('Weathered Observatory')
    expect(markup).not.toContain('View 360')
  })
})
