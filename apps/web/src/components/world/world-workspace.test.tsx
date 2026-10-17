import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }))

import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { WorldWorkspace } from './world-workspace'

describe('World page', () => {
  it('labels the current tile safe or PvP without using a future route destination', () => {
    const state = newWorldState()
    state.route = [{ position: { ...state.position, x: 10 }, durationMs: 200 }]
    for (const [x, label, zone] of [
      [5, 'Safe Zone', 'safe'],
      [10, 'PvP Zone', 'pvp'],
    ] as const) {
      state.position = { ...state.position, x }
      const markup = renderToStaticMarkup(
        createElement(WorldWorkspace, {
          initialView: projectWorld(state, [], 1000),
          character: { name: 'Traveller', portrait: '/portrait.webp' },
        }),
      )
      expect(markup).toMatch(new RegExp(`data-world-zone="${zone}"[^>]*>${label}<`))
      expect(markup).not.toContain(zone === 'safe' ? 'PvP Zone' : 'Safe Zone')
    }
  })
  it('does not classify missing current terrain from a neighbouring sector', () => {
    const view = projectWorld(newWorldState(), [], 1000)
    view.sectors = view.sectors.filter((sector) => sector.id !== view.position.sectorId)
    const markup = renderToStaticMarkup(
      createElement(WorldWorkspace, {
        initialView: view,
        character: { name: 'Traveller', portrait: '/portrait.webp' },
      }),
    )
    expect(markup).toMatch(/data-world-zone="unknown"[^>]*>Zone unavailable</)
    expect(markup).not.toContain('Safe Zone')
    expect(markup).not.toContain('PvP Zone')
  })
  it('omits the removed town panorama button while retaining map settings', () => {
    const render = (view: ReturnType<typeof projectWorld>) =>
      renderToStaticMarkup(
        createElement(WorldWorkspace, {
          initialView: view,
          character: { name: 'Traveller', portrait: '/portrait.webp' },
        }),
      )
    const town = projectWorld(newWorldState(), [], 1000)
    const markup = render(town)
    expect(markup).not.toContain('View Town')
    expect(markup).not.toContain('View 360')
    expect(markup).toContain('aria-label="Map settings"')
    const state = newWorldState()
    state.position = { sectorId: 'crown-road', x: 5, y: 4 }
    expect(render(projectWorld(state, [], 1000))).not.toContain('View Town')
  })
  it('shows the confirmed current sector and east/north coordinates beside the panel gear', () => {
    const state = newWorldState()
    state.position = { sectorId: 'atlas:58:28', x: 6, y: 4 }
    state.route = [{ position: { ...state.position, x: 10 }, durationMs: 200 }]
    const view = projectWorld(state, [], 1000)
    view.sectors.reverse()
    const render = () =>
      renderToStaticMarkup(
        createElement(WorldWorkspace, {
          initialView: view,
          character: { name: 'Traveller', portrait: '/portrait.webp' },
        }),
      )
    const foot = (markup: string) =>
      markup.match(/<div class="[^"]*panelFoot[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? ''
    const initial = foot(render())
    expect(initial).toContain('data-world-coordinates')
    expect(initial).toContain('Sector S59-29')
    expect(initial).toContain('N320')
    expect(initial).toContain('E760')
    expect(initial).not.toContain('E764')
    expect(initial).toContain('aria-label="Map settings"')
    view.position = { sectorId: 'atlas:58:28', x: 7, y: 3 }
    const moved = foot(render())
    expect(moved).toContain('N321')
    expect(moved).toContain('E761')
    expect(moved).not.toContain('N320')
  })
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
  it('reserves compact Nearby portrait slots while keeping full names and actions', () => {
    const view = projectWorld(newWorldState(), [], 1000)
    view.players = [
      {
        characterId: 'density-peer',
        name: 'Sellophina',
        level: 3,
        portraitRef: '',
        imageUrl: '/original-clear-portrait.webp',
        online: true,
        attackable: false,
        position: { ...view.position, x: view.position.x + 3 },
      },
    ]
    const markup = renderToStaticMarkup(
      createElement(WorldWorkspace, {
        initialView: view,
        character: { name: 'Traveller', portrait: '/portrait.webp' },
      }),
    )
    const row = markup.match(/<article[^>]*data-world-player="density-peer"[\s\S]*?<\/article>/)![0]
    expect(row).toContain('width="36"')
    expect(row).toContain('height="36"')
    expect(row).toContain('src="/original-clear-portrait.webp"')
    expect(row).toContain('<strong title="Sellophina">Sellophina</strong>')
    expect(row).toContain('Level 3')
    expect(row).toContain('Approach')
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
  it('keeps the World header to a text-free Details toggle without a duplicate gear or online count', () => {
    const markup = renderToStaticMarkup(
      createElement(WorldWorkspace, {
        initialView: projectWorld(newWorldState(), [], 1000),
        character: { name: 'Traveller', portrait: '/portrait.webp' },
      }),
    )
    expect(markup).toContain('aria-label="Details"')
    expect(markup).not.toContain('Online Users')
    expect(markup).not.toContain('mobileSettings')
  })
})
