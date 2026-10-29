import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PublicCharacterPortrait, PublicCharacterProfile } from './public-character-profile'

describe('Public character profile', () => {
  it('uses a native dialog with a compact public-only identity card', () => {
    const character = {
      characterId: 'character-1',
      name: 'Aster Vale',
      level: 12,
      xp: 12345,
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
    expect(markup).toContain('No recorded activity')
    expect(markup).not.toContain('Close public character profile')
    expect(markup).not.toContain('Public profiles intentionally omit')
    expect(markup).not.toContain('Send Direct Message')
    expect(markup).not.toContain('Add Friend')
    for (const privateValue of [character.pronouns, character.email, ...character.inventory])
      expect(markup).not.toContain(privateValue)
  })
})

it('renders a selected starter portrait for a public character without a custom image', () => {
  const markup = renderToStaticMarkup(
    createElement(PublicCharacterPortrait, {
      character: {
        characterId: 'character-starter',
        name: 'Starter Vale',
        level: 1,
        xp: 0,
        lastSeenAt: '2026-09-24T00:00:00Z',
        portraitRef: 'portrait.starter.wayfarer-07',
        disciplineId: null,
        secondaryDisciplineId: null,
        personalTitle: null,
        imageUrl: null,
      },
    }),
  )

  expect(markup).toContain('<img')
  expect(markup).toContain('/api/media/starter-portrait/portrait.starter.wayfarer-07')
  expect(markup).toContain('Starter Vale portrait')
})

it('uses current published Discipline names in the profile too', () => {
  const markup = renderToStaticMarkup(
    createElement(PublicCharacterProfile, {
      character: {
        characterId: 'character-custom',
        name: 'Zei',
        level: 2,
        xp: 111,
        lastSeenAt: null,
        portraitRef: null,
        disciplineId: 'discipline.f60c5dc7-abf2-4e03-8b10-428dee7fc4c2',
        secondaryDisciplineId: 'ironfist',
        disciplineName: 'Super Saiyan',
        secondaryDisciplineName: 'Ironfist',
        isOnline: true,
        personalTitle: null,
        imageUrl: null,
      },
      nowMs: 0,
      onClose: () => undefined,
    }),
  )
  expect(markup).toContain('>Super Saiyan</span>')
  expect(markup).not.toContain('F60c5dc7')
})
