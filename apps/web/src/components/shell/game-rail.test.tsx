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
  it('exposes only Character, Arsenal, Battle Hall, and Training without duplicating identity', () => {
    navigationState.pathname = '/game/character'
    const markup = renderRail()
    const destinations = [
      ['/game/character', 'Character'],
      ['/game/arsenal', 'Arsenal'],
      ['/game/battle', 'Battle Hall'],
      ['/game/training', 'Passive Training'],
    ] as const
    for (const [href, label] of destinations) {
      expect(markup).toContain(`href="${href}"`)
      expect(markup).toContain(`aria-label="${label}"`)
    }
    expect(markup).not.toContain('aria-label="Items"')
    expect(markup).not.toContain('href="/game/items"')
    expect(markup).toContain('data-nav-icon="arsenal"')
    expect(markup).toContain('data-nav-icon="battle"')
    expect(markup).not.toContain('href="/game/online"')
    expect(markup).not.toContain('Adventurers')
    expect(markup).toContain('aria-current="page"')
    expect(markup).not.toContain('Current character:')
    expect(markup).not.toContain('Aster')
    expect(markup.match(/data-aether-bubble="true"/g)).toHaveLength(14)
    expect(markup).toContain('aria-hidden="true"')
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
    expect(markup.match(/disabled=""/g)).toHaveLength(4)
    expect(markup).toContain(`href="${href}"`)
    expect(markup).toContain(label)
    expect(markup).not.toContain('href="/game/character"')
    expect(markup).not.toContain('href="/game/arsenal"')
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
