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
  AccountMenu: ({
    characterName,
    masterPanelHref,
  }: {
    characterName?: string | null
    masterPanelHref?: string | null
  }) =>
    createElement(
      'div',
      { 'data-testid': 'account-menu' },
      characterName ? `Welcome back, ${characterName}.` : 'Account',
      masterPanelHref
        ? createElement('a', { href: masterPanelHref, 'data-testid': 'master-panel-link' }, 'Master Panel')
        : null,
    ),
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

  it('forwards server-authorized Master Panel access into the Account menu', () => {
    const markup = renderToStaticMarkup(
      <AuthenticatedShellPresentation masterPanelHref="/master">
        <section>Page content</section>
      </AuthenticatedShellPresentation>,
    )

    expect(markup).toContain('data-testid="master-panel-link"')
    expect(markup).toContain('href="/master"')
  })

  it('renders character identity beside Account without the retired workspace strip or level', () => {
    const markup = renderToStaticMarkup(
      <AuthenticatedShellPresentation
        sessionLabel="Battle Hall"
        character={{ name: 'Aster', level: 12 }}
        characterPortrait={<span data-testid="portrait">portrait</span>}
      >
        <section>Page content</section>
      </AuthenticatedShellPresentation>,
    )

    expect(markup).not.toContain('data-av-context-strip="true"')
    expect(markup).not.toContain('Current workspace')
    expect(markup).toContain('Welcome back, Aster.')
    expect(markup).not.toContain('<strong>Aster</strong>')
    expect(markup).not.toContain('Level 12')
    expect(markup).toContain('data-testid="portrait"')
    expect(markup).toContain('data-testid="account-menu"')
  })
})
