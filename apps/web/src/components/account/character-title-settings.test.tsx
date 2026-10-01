import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { CharacterTitleSettings } from './character-title-settings'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const character = {
  characterId: 'character-01',
  characterName: 'Elara',
  disciplineName: 'Cinder',
  personalTitle: null,
  personalTitleSetAt: null,
  imageUrl: null,
}

describe('Portrait & Title settings', () => {
  it('opens directly on editable title and portrait controls without a duplicate identity summary', () => {
    const markup = renderToStaticMarkup(createElement(CharacterTitleSettings, character))

    expect(markup).not.toContain('aria-labelledby="current-title-heading"')
    expect(markup).not.toContain('Profile identity badges')
    expect(markup).toContain('aria-labelledby="personal-title-heading"')
    expect(markup).toContain('placeholder="e.g. Dawn Warden"')
    expect(markup).toContain('Review Title')
    expect(markup).toContain('Direct image URL')
    expect(markup).toContain('Save Profile Image')
  })

  it('keeps the confirmed personal title locked while portrait editing remains available', () => {
    const markup = renderToStaticMarkup(
      createElement(CharacterTitleSettings, {
        ...character,
        personalTitle: 'Dawn Warden',
        personalTitleSetAt: '2026-09-30T12:00:00Z',
        imageUrl: 'https://images.example.com/elara.webp',
      }),
    )

    expect(markup).toContain('Choice used')
    expect(markup).toContain('Dawn Warden')
    expect(markup).not.toContain('Review Title')
    expect(markup).not.toContain('placeholder="e.g. Dawn Warden"')
    expect(markup).toContain('alt="Elara profile preview"')
    expect(markup).toContain('value="https://images.example.com/elara.webp"')
    expect(markup).toContain('Save Profile Image')
  })
})
