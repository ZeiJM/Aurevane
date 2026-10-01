import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@aurevane/ui', () => ({ Kicker: () => null, Surface: () => null }))
vi.mock('@/components/character/character-identity-card', () => ({
  CharacterIdentityCard: () => null,
}))
vi.mock('@/components/character/character-portrait-image', () => ({
  CharacterPortraitImage: () => createElement('img', { src: 'built-in-portrait.webp', alt: '' }),
}))
vi.mock('@/media/character', () => ({ getStarterPortraitImageAssetId: () => 'starter' }))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: 'user-1' }),
}))
vi.mock('@/server/account/active-game-session', () => ({
  getActiveBattleForUser: async () => null,
  getActiveSpectatingForUser: async () => null,
}))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: async () => ({
    id: 'character-1',
    name: 'Zei',
    level: 3,
    portraitRef: 'starter',
  }),
}))
vi.mock('@/server/character/character-profile-display-service', () => ({
  loadCharacterProfileDisplay: vi.fn(),
}))
vi.mock('@/server/character/character-identity-rail-context', () => ({
  loadCharacterIdentityRailContext: vi.fn(),
}))
vi.mock('./authenticated-shell-presentation', () => ({
  AuthenticatedShellPresentation: () => null,
}))

import { AuthenticatedShellFrame } from './authenticated-game-shell'
import { loadCharacterProfileDisplay } from '@/server/character/character-profile-display-service'

type Boundary = ReactElement<{ fallback: ReactElement; children: ReactElement }>
describe('portrait loading in the authenticated shell', () => {
  it('reserves portrait space without flashing a default while cosmetic data loads', async () => {
    const shell = await AuthenticatedShellFrame({ children: null })
    const props = shell.props as { characterPortrait: Boundary; railIdentity: Boundary }
    for (const boundary of [props.characterPortrait, props.railIdentity]) {
      const markup = renderToStaticMarkup(boundary.props.fallback)
      expect(markup).not.toContain('<img')
      expect(markup).toContain('data-portrait-pending="true"')
    }
    expect(renderToStaticMarkup(props.railIdentity.props.fallback)).toContain('Zei')
  })

  it('retains the built-in portrait after cosmetic data is unavailable', async () => {
    vi.mocked(loadCharacterProfileDisplay).mockRejectedValueOnce(new Error('unavailable'))
    const shell = await AuthenticatedShellFrame({ children: null })
    const boundary = shell.props.characterPortrait as Boundary
    const portrait = boundary.props.children as ReactElement<{ userId: string; character: unknown }>
    const resolved = await (
      portrait.type as (props: typeof portrait.props) => Promise<ReactElement>
    )(portrait.props)
    expect(renderToStaticMarkup(resolved)).toContain('built-in-portrait.webp')
  })
})
