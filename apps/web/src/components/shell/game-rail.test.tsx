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
  it('exposes locked Arsenal above Nexus and preserves the intended navigation order', () => {
    navigationState.pathname = '/game/character'
    const markup = renderRail()
    const destinations = [
      ['/game/character', 'Character'],
      ['/game/nexus', 'Nexus'],
      ['/game/world', 'World Map'],
      ['/game/battle', 'Battle Hall'],
      ['/game/training', 'Passive Training'],
    ] as const
    for (const [href, label] of destinations) {
      expect(markup).toContain(`href="${href}"`)
      expect(markup).toContain(`aria-label="${label}"`)
    }
    const destinationPositions = destinations.map(([href]) => markup.indexOf(`href="${href}"`))
    expect(destinationPositions).toEqual(
      [...destinationPositions].sort((left, right) => left - right),
    )
    expect(markup).toContain('aria-label="Arsenal"')
    expect(markup).toContain('title="Items — Coming Soon"')
    expect(markup).not.toContain('href="/game/arsenal"')
    expect(markup.match(/disabled=""/g)).toHaveLength(1)
    expect(markup.indexOf('aria-label="Arsenal"')).toBeLessThan(
      markup.indexOf('aria-label="Nexus"'),
    )
    expect(markup).toContain('data-nav-icon="arsenal"')
    expect(markup).toContain('data-nav-icon="nexus"')
    expect(markup).toContain('data-nav-icon="battle"')
    expect(markup).not.toContain('href="/game/online"')
    expect(markup).not.toContain('Adventurers')
    expect(markup).toContain('aria-current="page"')
    expect(markup).not.toContain('Current character:')
    expect(markup).not.toContain('Aster')
    expect(markup.match(/data-aether-orb="true"/g)).toHaveLength(12)
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).not.toContain('data-mana-strand="true"')
    expect(markup).not.toContain('data-mana-wisp="true"')
    expect(markup).not.toContain('data-aether-bubble="true"')
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
    expect(markup.match(/disabled=""/g)).toHaveLength(6)
    expect(markup).toContain(`href="${href}"`)
    expect(markup).toContain(label)
    expect(markup).not.toContain('href="/game/character"')
    expect(markup).not.toContain('href="/game/nexus"')
    expect(markup).not.toContain('href="/game/training"')
    expect(markup).not.toContain('href="/game/online"')
  })

  it('marks Nexus active without activating the locked Arsenal placeholder', () => {
    navigationState.pathname = '/game/nexus'
    const markup = renderRail()
    expect(markup).toContain('href="/game/nexus"')
    expect(markup).toContain('aria-current="page"')
    expect(markup).toContain('aria-label="Arsenal"')
    expect(markup).not.toContain('href="/game/arsenal"')
  })

  it('does not mark an unrelated route as the active destination or invent a character', () => {
    navigationState.pathname = '/game/settings/controls'
    const markup = renderRail()
    expect(markup).not.toContain('aria-current="page"')
    expect(markup).not.toContain('Current character:')
  })
})
