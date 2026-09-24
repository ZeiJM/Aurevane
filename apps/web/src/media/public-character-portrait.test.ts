import { describe, expect, it } from 'vitest'

import { resolvePublicCharacterImageUrl } from './public-character-portrait'

describe('public character image resolution', () => {
  it('prefers the current custom profile image over the starter portrait', () => {
    expect(
      resolvePublicCharacterImageUrl(
        'https://images.example.test/current-profile.webp',
        'portrait.starter.wayfarer-07',
      ),
    ).toBe('https://images.example.test/current-profile.webp')
  })

  it('uses the selected starter portrait when no custom profile image exists', () => {
    expect(resolvePublicCharacterImageUrl(null, 'portrait.starter.wayfarer-07')).toBe(
      '/api/media/starter-portrait/portrait.starter.wayfarer-07',
    )
  })

  it('returns no public image for an invalid portrait reference', () => {
    expect(resolvePublicCharacterImageUrl(null, 'portrait.invalid')).toBeNull()
  })
})
