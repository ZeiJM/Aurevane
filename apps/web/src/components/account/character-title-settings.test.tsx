import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { STARTER_TITLES } from '@/appearance/starter-titles'
import { CharacterTitleSettings } from './character-title-settings'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const character = {
  characterId: 'character-01',
  personalTitle: null,
  appearanceTokens: 99,
  pendingSpriteDesign: false,
}

it('offers all three starter titles and uses inventory for appearance changes', () => {
  const markup = renderToStaticMarkup(createElement(CharacterTitleSettings, character))
  for (const title of STARTER_TITLES) expect(markup).toContain(title)
  expect(markup).toContain('99 Appearance Tokens available.')
  expect(markup).toContain('Design sprite')
  expect(markup).not.toMatch(/Direct image URL|Choose Default Portrait|Distinctions|Review Title/)
})

it('shows the equipped title and allows sprite previews at zero tokens', () => {
  const markup = renderToStaticMarkup(
    createElement(CharacterTitleSettings, {
      ...character,
      personalTitle: 'Roadfarer',
      appearanceTokens: 0,
      pendingSpriteDesign: true,
    }),
  )
  expect(markup).toContain('aria-pressed="true">Roadfarer')
  expect(markup).toContain('Equipped')
  expect(markup).toContain('0 Appearance Tokens available.')
  expect(markup).toContain('Ready — applies after this battle.')
  expect(markup).toMatch(/aria-haspopup="dialog"[^>]*>Design sprite/)
  expect(markup).toMatch(/disabled="">Confirm appearance/)
})
