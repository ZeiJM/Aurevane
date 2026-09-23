import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PublicCharacterProfile } from './public-character-profile'

describe('Public character profile', () => {
  it('uses a native dialog with a compact public-only identity card', () => {
    const character = {
      characterId: 'character-1',
      name: 'Aster Vale',
      level: 12,
      lastSeenAt: null,
      portraitRef: null,
      disciplineId: 'vanguard',
      secondaryDisciplineId: 'aetherist',
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
    expect(markup).toContain('>Vanguard</span>')
    expect(markup).toContain('>Aetherist</span>')
    expect(markup).not.toContain('Primary ·')
    expect(markup).not.toContain('Secondary ·')
    expect(markup).toContain('Never seen')
    expect(markup).not.toContain('Close public character profile')
    expect(markup).not.toContain('Public profiles intentionally omit')
    expect(markup).not.toContain('Send Direct Message')
    expect(markup).not.toContain('Add Friend')
    for (const privateValue of [character.pronouns, character.email, ...character.inventory])
      expect(markup).not.toContain(privateValue)
  })
})
