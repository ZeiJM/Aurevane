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
  it('uses a decorative flowing field and preserves the identity content', () => {
    const markup = renderRail({ characterIdentity: <article>Character resources</article> })
    expect(markup).toContain('data-aether-wisp="true"')
    expect(markup).toContain('data-aether-runes="true"')
    expect(markup).not.toContain('data-aether-orb')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('Character resources')
  })

  it('keeps settings in Account rather than duplicating them in the rail', () => {
    const markup = renderRail()
    expect(markup).not.toContain('href="/game/account/titles"')
    expect(markup).not.toContain('href="/game/settings/audio"')
    expect(markup).not.toContain('href="/game/settings/controls"')
  })

  it('starts at Haven, groups Nexus and Items under Loadout, and uses compact labels', () => {
    navigationState.pathname = '/game/haven'
    const markup = renderRail()
    const destinations = [
      ['/game/haven', 'Haven'],
      ['/game/character', 'Profile'],
      ['/game/loadout', 'Loadout'],
      ['/game/world', 'Travel'],
      ['/game/battle', 'Battle'],
      ['/game/training', 'Training'],
    ]
    const positions = destinations.map(([href, label]) => {
      expect(markup).toContain(`href="${href}"`)
      expect(markup).toContain(`aria-label="${label}"`)
      return markup.indexOf(`href="${href}"`)
    })
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(markup).not.toContain('aria-label="Arsenal"')
    expect(markup).not.toContain('href="/game/nexus"')
    expect(markup).toContain('aria-current="page"')
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
    expect(markup).not.toContain('href="/game/settings/audio"')
    expect(markup).not.toContain('href="/game/settings/controls"')
  })

  it('keeps Loadout active inside Nexus', () => {
    navigationState.pathname = '/game/nexus'
    expect(renderRail()).toMatch(/href="\/game\/loadout"[^>]*aria-current="page"/)
  })
})
