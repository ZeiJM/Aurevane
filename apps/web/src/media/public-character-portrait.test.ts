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
      '/api/media/starter-portrait/portrait.starter.wayfarer-07?v=wayfarer-v02',
    )
  })

  it('versions exactly the replaced Wayfarer portraits without changing other images', () => {
    for (let number = 2; number <= 40; number += 1) {
      const ref = `portrait.starter.wayfarer-${String(number).padStart(2, '0')}`
      expect(resolvePublicCharacterImageUrl('', ref)).toBe(
        `/api/media/starter-portrait/${ref}?v=wayfarer-v02`,
      )
    }
    expect(resolvePublicCharacterImageUrl(null, 'portrait.starter.wayfarer-01')).toBe(
      '/api/media/starter-portrait/portrait.starter.wayfarer-01',
    )
    expect(resolvePublicCharacterImageUrl(null, 'portrait.adventure.male-01')).toBe(
      '/api/media/starter-portrait/portrait.adventure.male-01',
    )
    expect(
      resolvePublicCharacterImageUrl(
        ' https://images.example.test/custom.webp?v=unchanged ',
        'portrait.starter.wayfarer-02',
      ),
    ).toBe('https://images.example.test/custom.webp?v=unchanged')
  })

  it('returns no public image for an invalid portrait reference', () => {
    expect(resolvePublicCharacterImageUrl(null, 'portrait.invalid')).toBeNull()
  })
})
