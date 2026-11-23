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
  remainingSpriteDesigns: 2,
  pendingSpriteDesign: false,
}

describe('Portrait & Title settings', () => {
  it('offers repeatable default portrait selection even after an earlier saved choice', () => {
    const markup = renderToStaticMarkup(
      createElement(CharacterTitleSettings, {
        ...character,
        portraitChoiceAvailable: true,
        portraitChoiceUsedAt: null,
        portraitRef: 'portrait.adventure.male-01',
      }),
    )
    expect(markup).toContain('Confirm Default Portrait')
    expect(markup).toContain('name="default-portrait"')
    expect(markup).toContain(
      'Confirming replaces any custom portrait URL with the portrait you choose.',
    )
    expect(markup).toContain('A shared appearance takes precedence over your default portrait.')
    expect(markup).not.toContain('only once')
    const portraitDialog = markup.match(
      /<dialog\b[^>]*aria-labelledby="default-portrait-heading"[^>]*>[\s\S]*?<\/dialog>/u,
    )?.[0]
    expect(portraitDialog).toBeDefined()
    expect(portraitDialog).not.toContain('type="checkbox"')
    expect(portraitDialog).toContain('aria-label="Portrait selection"')
    expect(markup.match(/name="default-portrait"/gu)).toHaveLength(64)
    expect(markup).toContain('Choose Default Portrait')
    expect(markup).toContain('<dialog')
    expect(markup).not.toContain('<dialog open')
    const locked = renderToStaticMarkup(
      createElement(CharacterTitleSettings, {
        ...character,
        portraitChoiceAvailable: true,
        portraitChoiceUsedAt: '2026-10-03T00:00:00Z',
      }),
    )
    expect(locked).toContain('Confirm Default Portrait')
    expect(locked).toContain('Choose Default Portrait')
    expect(locked).not.toContain('Default portrait choice used')
    expect(locked).toContain('Save Profile Image')
  })
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

  it('shows the sprite allowance and locks only the sprite editor at zero', () => {
    const open = renderToStaticMarkup(createElement(CharacterTitleSettings, character))
    expect(open).toContain('2 sprite design saves remaining.')
    const locked = renderToStaticMarkup(
      createElement(CharacterTitleSettings, {
        ...character,
        remainingSpriteDesigns: 0,
        pendingSpriteDesign: true,
        portraitChoiceAvailable: true,
      }),
    )
    expect(locked).toContain('Your sprite design is permanently locked.')
    expect(locked).toContain('aria-disabled="true">Design sprite')
    expect(locked).toContain('Ready — applies after this battle.')
    expect(locked).toContain('Choose Default Portrait')
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
