import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@aurevane/ui', () => ({ Kicker: () => null, Surface: () => null }))
vi.mock('@/components/character/character-identity-card', () => ({
  CharacterIdentityCard: ({ imageUrl }: { imageUrl?: string }) =>
    createElement('img', { src: imageUrl ?? 'built-in-portrait.webp', alt: '' }),
}))
vi.mock('@/components/character/character-portrait-image', () => ({
  CharacterPortraitImage: ({ imageUrl }: { imageUrl?: string }) =>
    createElement('img', { src: imageUrl ?? 'built-in-portrait.webp', alt: '' }),
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

import { loadCharacterIdentityRailContext } from '@/server/character/character-identity-rail-context'

describe('portrait loading in the authenticated shell', () => {
  beforeEach(() => {
    vi.mocked(loadCharacterProfileDisplay).mockReset().mockResolvedValue({ imageUrl: null })
    vi.mocked(loadCharacterIdentityRailContext)
      .mockReset()
      .mockResolvedValue(null as never)
  })

  it('waits for both identity reads before exposing the shell on navigation or refresh', async () => {
    const imageUrl = 'https://portraits.example/zei.gif'
    let resolveDisplay!: (value: { imageUrl: string }) => void
    let resolveIdentity!: (
      value: Awaited<ReturnType<typeof loadCharacterIdentityRailContext>>,
    ) => void
    vi.mocked(loadCharacterProfileDisplay).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDisplay = resolve
      }),
    )
    vi.mocked(loadCharacterIdentityRailContext).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveIdentity = resolve
      }),
    )
    let settled = false
    const pendingShell = AuthenticatedShellFrame({ children: null }).then((shell) => {
      settled = true
      return shell
    })
    await vi.waitFor(() => {
      expect(loadCharacterProfileDisplay).toHaveBeenCalledWith('user-1', 'character-1')
      expect(loadCharacterIdentityRailContext).toHaveBeenCalled()
    })
    expect(settled).toBe(false)
    resolveDisplay({ imageUrl })
    await Promise.resolve()
    expect(settled).toBe(false)
    resolveIdentity({ imageUrl } as Awaited<ReturnType<typeof loadCharacterIdentityRailContext>>)
    const shell = await pendingShell
    for (const portrait of [shell.props.characterPortrait, shell.props.railIdentity]) {
      const markup = renderToStaticMarkup(portrait as ReactElement)
      expect(markup).toContain(imageUrl)
      expect(markup).not.toContain('data-portrait-pending')
      expect(markup).not.toContain('built-in-portrait.webp')
    }
  })

  it('keeps the resolved custom portrait if the remaining rail identity cannot load', async () => {
    vi.mocked(loadCharacterProfileDisplay).mockResolvedValueOnce({
      imageUrl: 'https://portraits.example/zei.webp',
    })
    vi.mocked(loadCharacterIdentityRailContext).mockRejectedValueOnce(new Error('unavailable'))
    const shell = await AuthenticatedShellFrame({ children: null })
    expect(renderToStaticMarkup(shell.props.railIdentity as ReactElement)).toContain(
      'https://portraits.example/zei.webp',
    )
  })

  it('retains the built-in portrait after cosmetic data is unavailable', async () => {
    vi.mocked(loadCharacterProfileDisplay).mockRejectedValueOnce(new Error('unavailable'))
    const shell = await AuthenticatedShellFrame({ children: null })
    expect(renderToStaticMarkup(shell.props.characterPortrait as ReactElement)).toContain(
      'built-in-portrait.webp',
    )
  })

  it('does not load the unused roaming rail on the battlefield', async () => {
    const shell = await AuthenticatedShellFrame({ children: null, layout: 'battlefield' })
    expect(shell.props.railIdentity).toBeNull()
    expect(loadCharacterIdentityRailContext).not.toHaveBeenCalled()
  })
})
