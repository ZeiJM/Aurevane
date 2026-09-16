import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/components/shell/account-menu', () => ({ AccountMenu: () => null }))
vi.mock('@/components/media/aurevane-image', () => ({
  AurevaneImage: ({ assetId }: { assetId: string }) =>
    createElement('img', { alt: '', 'data-asset': assetId }),
}))

vi.mock('@/media/character', async () => import('../../media/character'))
vi.mock(
  '@/components/character/character-portrait-image',
  async () => import('./character-portrait-image'),
)
vi.mock('./foundation-discipline-sigil', () => ({
  FoundationDisciplineSigil: () => createElement('span'),
}))

import { CharacterCreationExperience } from './character-creation-experience'
import { CharacterSelectShell } from './character-select-shell'

const emptyRoster = () =>
  renderToStaticMarkup(
    createElement(CharacterSelectShell, {
      characters: [],
      selectedCharacter: null,
      profileImageUrls: {},
      accountDeletion: null,
    }),
  )

describe('approved character workspace composition', () => {
  it('keeps three real slots, their unlock explanations, and only the eligible creation link', () => {
    const markup = emptyRoster()
    expect(markup.match(/<article\b/g)).toHaveLength(3)
    expect(markup.match(/href="\/game\/create\//g)).toHaveLength(1)
    expect(markup).toContain('href="/game/create/0"')
    expect(markup).toContain('Slot 2 will be available for purchase at a later time.')
    expect(markup).toContain(
      'Slot 3 unlocks free after this account completes its first Prestige Rebirth.',
    )
  })

  it('places account deletion below the roster rather than beside primary navigation', () => {
    const markup = emptyRoster()
    expect(markup.indexOf('data-testid="delete-account-button"')).toBeGreaterThan(
      markup.indexOf('</section>'),
    )
  })

  it('keeps empty and locked slots in the dark roster workspace', () => {
    expect(emptyRoster()).not.toContain('data-av-surface="moonstone"')
  })

  it('presents the complete native-radio portrait library before the identity form', () => {
    const markup = renderToStaticMarkup(
      createElement(CharacterCreationExperience, { slotIndex: 0 }),
    )
    expect(markup.match(/name="portrait"/g)).toHaveLength(40)
    expect(markup.indexOf('Choose a starting portrait')).toBeLessThan(
      markup.indexOf('Character name'),
    )
    expect(markup).toContain('Selected portrait preview')
    expect(markup).toContain('Starter appearance')
    expect(markup).toContain('Presentation')
    expect(markup).not.toMatch(/pronoun/i)
  })

  it('announces the active creation step and uses an ink information surface', () => {
    const markup = renderToStaticMarkup(
      createElement(CharacterCreationExperience, { slotIndex: 0 }),
    )
    expect(markup).toContain('aria-current="step"')
    expect(markup).toContain('data-av-surface="ink"')
    expect(markup).not.toContain('data-av-surface="moonstone"')
  })
})
