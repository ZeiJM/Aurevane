import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PublicCharacterProfile } from './public-character-profile'

describe('Public character profile', () => {
  it('uses a native dialog and only public identity fields, with future actions disabled', () => {
    const character = {
      characterId: 'character-1',
      name: 'Aster Vale',
      level: 12,
      lastSeenAt: null,
      portraitRef: null,
      disciplineId: 'vanguard',
      personalTitle: 'The Patient Flame',
      imageUrl: null,
      isOnline: false,
      pronouns: 'private-pronoun-sentinel',
      email: 'private-email-sentinel',
      inventory: ['private-inventory-sentinel'],
    }
    const markup = renderToStaticMarkup(
      createElement(PublicCharacterProfile, { character, nowMs: 0, onClose: () => undefined }),
    )
    expect(markup).toContain('<dialog')
    expect(markup).toContain('Aster Vale')
    expect(markup).toContain('The Patient Flame')
    expect(markup).toContain('Never seen')
    expect(markup.match(/disabled=""/g)).toHaveLength(2)
    for (const privateValue of [character.pronouns, character.email, ...character.inventory])
      expect(markup).not.toContain(privateValue)
  })
})
