import type { Route } from 'next'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const navigationState = vi.hoisted(() => ({ pathname: '/game/character' }))
vi.mock('next/navigation', () => ({ usePathname: () => navigationState.pathname }))
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) =>
    createElement('a', props, children),
}))

import { GameRail } from './game-rail'

function renderRail(props: Parameters<typeof GameRail>[0] = {}) {
  return renderToStaticMarkup(createElement(GameRail, props))
}

describe('shared game rail', () => {
  it('exposes the three primary destinations and selected character identity', () => {
    navigationState.pathname = '/game/character'
    const markup = renderRail({ character: { name: 'Aster', level: 12 } })
    const destinations = [
      ['/game/character', 'Profile'],
      ['/game/battle', 'Battle Hall'],
      ['/game/training', 'Passive Training'],
    ] as const
    for (const [href, label] of destinations) {
      expect(markup).toContain(`href="${href}"`)
      expect(markup).toContain(`aria-label="${label}"`)
    }
    expect(markup).not.toContain('href="/game/online"')
    expect(markup).not.toContain('Adventurers')
    expect(markup).toContain('aria-current="page"')
    expect(markup).toContain('Current character: Aster, Level 12')
  })

  it.each([
    ['/game/battle/session-one', 'Return to Active Battle'],
    ['/game/battle/spectate/example-key', 'Return to Spectated Battle'],
  ])('preserves restrictions and the return-session link for %s', (href, label) => {
    navigationState.pathname = href
    const markup = renderRail({
      activeSessionHref: href as Route,
      activeSessionLabel: label,
    })
    expect(markup.match(/disabled=""/g)).toHaveLength(3)
    expect(markup).toContain(`href="${href}"`)
    expect(markup).toContain(label)
    expect(markup).not.toContain('href="/game/character"')
    expect(markup).not.toContain('href="/game/training"')
    expect(markup).not.toContain('href="/game/online"')
  })

  it('does not mark an unrelated route as the active destination or invent a character', () => {
    navigationState.pathname = '/game/settings/controls'
    const markup = renderRail()
    expect(markup).not.toContain('aria-current="page"')
    expect(markup).not.toContain('Current character:')
  })
})
