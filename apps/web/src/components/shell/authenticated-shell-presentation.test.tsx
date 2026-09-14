import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) =>
    createElement('a', props, children),
}))
vi.mock('@aurevane/ui', () => ({
  StatusMark: () => createElement('span', { 'data-testid': 'status-mark' }, 'status'),
}))
vi.mock('@/media/registry', () => ({
  getImageAsset: () => ({ src: '/world.webp', width: 1600, height: 900 }),
}))
vi.mock('@/components/battle/pvp-battle-key-input-assist', () => ({
  PvpBattleKeyInputAssist: () => null,
}))
vi.mock('./account-menu', () => ({
  AccountMenu: () => createElement('div', { 'data-testid': 'account-menu' }, 'Account'),
}))
vi.mock('./game-rail', () => ({
  GameRail: () => createElement('aside', { 'data-testid': 'game-rail' }, 'Rail'),
}))
vi.mock('./online-presence-link', () => ({
  OnlinePresenceLink: () => createElement('a', { href: '/game/online' }, 'Online Users'),
}))
vi.mock('./navigation-menu', () => ({
  NavigationMenu: () => createElement('button', { type: 'button' }, 'Navigation'),
}))

import { AuthenticatedShellPresentation } from './authenticated-shell-presentation'

describe('authenticated shell presentation', () => {
  it('keeps Online Users while omitting redundant back and footer navigation controls', () => {
    const markup = renderToStaticMarkup(
      createElement(AuthenticatedShellPresentation, {
        backHref: '/game',
        backLabel: 'Back to game',
        sessionLabel: 'Passive Training',
        children: createElement('section', null, 'Page content'),
      }),
    )

    expect(markup).toContain('Online Users')
    expect(markup).not.toContain('aria-label="Back to game"')
    expect(markup).not.toContain('>Navigation<')
  })
})
