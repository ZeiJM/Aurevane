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

import { AuthenticatedShellPresentation } from './authenticated-shell-presentation'

describe('authenticated shell presentation', () => {
  it('keeps Online Users while omitting redundant back and footer navigation controls', () => {
    const markup = renderToStaticMarkup(
      <AuthenticatedShellPresentation
        backHref="/game"
        backLabel="Back to game"
        sessionLabel="Passive Training"
      >
        <section>Page content</section>
      </AuthenticatedShellPresentation>,
    )

    expect(markup).toContain('Online Users')
    expect(markup).not.toContain('aria-label="Back to game"')
    expect(markup).not.toContain('>Navigation<')
  })

  it('renders a dedicated context strip with current screen and character identity', () => {
    const markup = renderToStaticMarkup(
      <AuthenticatedShellPresentation
        sessionLabel="Battle Hall"
        character={{ name: 'Aster', level: 12 }}
        characterPortrait={<span data-testid="portrait">portrait</span>}
      >
        <section>Page content</section>
      </AuthenticatedShellPresentation>,
    )

    expect(markup).toContain('data-av-context-strip="true"')
    expect(markup).toContain('Battle Hall')
    expect(markup).toContain('Aster')
    expect(markup).toContain('Level 12')
    expect(markup).toContain('data-testid="portrait"')
  })
})
