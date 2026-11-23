import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { WorldMotion } from './world-motion'
import { WorldMap } from './world-map'

it('mounts a transparent identity canvas while keeping input and accessibility on the map', () => {
  const view = projectWorld(newWorldState(), [], 1000)
  const markup = renderToStaticMarkup(
    createElement(WorldMap, {
      view,
      motion: new WorldMotion(view),
      portrait: '/custom-portrait.webp',
      animate: true,
      paused: false,
      zoom: 1,
      zoomLocked: false,
      onZoom: vi.fn(),
      onWalk: vi.fn(),
      onStop: vi.fn(),
      onPlayer: vi.fn(),
      onVisiblePlayers: vi.fn(),
    }),
  )
  expect(markup.match(/<canvas\b/g)).toHaveLength(2)
  expect(markup.match(/role="application"/g)).toHaveLength(1)
  expect(markup).toContain('data-world-identity')
  expect(markup).toContain('pointer-events:none')
  expect(markup).toContain('aria-hidden="true"')
  expect(markup).toContain('data-portrait="/custom-portrait.webp"')
})
