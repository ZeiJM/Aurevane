import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { WorldLandmark } from '@/world/types'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }))
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>()
  return {
    ...react,
    // Open the existing Places tab without changing any production state or navigation.
    useState: (initial: unknown) => react.useState(initial === 'nearby' ? 'places' : initial),
  }
})

import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { WorldWorkspace } from './world-workspace'

function render(kind: WorldLandmark['kind'], sceneryIndex?: number, blocked = false) {
  const view = projectWorld(newWorldState(), [], 1000)
  const sector = view.sectors.find((sector) => sector.id === view.position.sectorId)!
  view.sectors = [
    {
      ...sector,
      landmarks: [{ id: 'place', name: 'A long place name', kind, x: 2, y: 4, sceneryIndex }],
    },
  ]
  if (blocked) view.movementBlocked = 'Stop Passive Training to travel.'
  const markup = renderToStaticMarkup(
    createElement(WorldWorkspace, {
      initialView: view,
      character: { name: 'Traveller', portrait: '/portrait.webp' },
    }),
  )
  return markup.match(/<div[^>]*id="places-content"[\s\S]*?<\/button>/)?.[0] ?? markup
}

describe('Places nearby representative portraits', () => {
  it.each([
    ['settlement', 'props-v02.webp', '33.33333333333333% 0%'],
    ['watchtower', 'buildings-v02.webp', '100% 100%'],
    ['bridge', 'props-v02.webp', '66.66666666666666% 0%'],
    ['marketplace', 'props-v02.webp', '0% 0%'],
    ['shrine', 'props-v02.webp', '0% 100%'],
    ['ruin', 'props-v02.webp', '100% 0%'],
    ['camp', 'props-v02.webp', '33.33333333333333% 100%'],
    ['spring', 'props-v02.webp', '66.66666666666666% 100%'],
    ['waystone', 'props-v02.webp', '100% 100%'],
    ['hamlet', 'buildings-v02.webp', '0% 0%'],
    ['grove', 'beauties-v03.webp', '66.66666666666666% 100%'],
    ['anchor', 'beauties-v03.webp', '33.33333333333333% 100%'],
  ] as const)(
    'uses the existing %s artwork cell without a diamond marker',
    (kind, sheet, position) => {
      const markup = render(kind)
      expect(markup).toContain(`background-image:url(/media/art/world/runtime/${sheet})`)
      expect(markup).toContain(`background-position:${position}`)
      expect(markup).toMatch(/<span[^>]*class="[^"]*placePortrait[^>]*aria-hidden="true"/)
      expect(markup).not.toContain('◇')
      expect(markup).toContain('A long place name')
      expect(markup).toContain('Verdant Expanse')
      expect(markup).toContain('↗')
      expect(markup).not.toContain('disabled=""')
    },
  )
  it.each([
    [0, '0% 0%'],
    [1, '33.33333333333333% 0%'],
    [2, '66.66666666666666% 0%'],
    [3, '100% 0%'],
    [4, '0% 100%'],
    [5, '33.33333333333333% 100%'],
    [6, '66.66666666666666% 100%'],
    [7, '100% 100%'],
  ])(
    'uses authored scenic cell %i in preference to the generic landmark kind',
    (index, position) => {
      const markup = render('spring', index as number)
      expect(markup).toContain('background-image:url(/media/art/world/runtime/beauties-v03.webp)')
      expect(markup).toContain(`background-position:${position}`)
    },
  )
  it.each([-1, 8, 1.5, NaN])(
    'keeps invalid scenic index %s within the named landmark artwork',
    (index) => {
      const markup = render('spring', index)
      expect(markup).toContain('background-image:url(/media/art/world/runtime/props-v02.webp)')
      expect(markup).toContain('background-position:66.66666666666666% 100%')
    },
  )
  it('keeps frontier locations out of Places and blocked travel disabled', () => {
    expect(render('frontier')).not.toContain('A long place name')
    expect(render('camp', undefined, true)).toContain('disabled=""')
  })
})
