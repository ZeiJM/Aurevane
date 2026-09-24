import { describe, expect, it } from 'vitest'
import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'

import { resolveCharacterPortraitImageUrl } from './character'

describe('character portrait resolution', () => {
  it('prefers an explicit profile image over the starter portrait', () => {
    expect(
      resolveCharacterPortraitImageUrl(
        'https://example.com/custom-character.webp',
        STARTER_CHARACTER_PORTRAITS[0]!.ref,
      ),
    ).toBe('https://example.com/custom-character.webp')
  })

  it('uses the selected starter portrait when no custom profile image exists', () => {
    const first = resolveCharacterPortraitImageUrl(null, STARTER_CHARACTER_PORTRAITS[0]!.ref)
    const second = resolveCharacterPortraitImageUrl(null, STARTER_CHARACTER_PORTRAITS[1]!.ref)

    expect(first).toMatch(/^\/media\//)
    expect(second).toMatch(/^\/media\//)
    expect(second).not.toBe(first)
  })

  it('does not invent a default portrait for an unknown reference', () => {
    expect(resolveCharacterPortraitImageUrl(null, 'portrait.unknown')).toBeNull()
  })
})
