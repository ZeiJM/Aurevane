import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { resolvePublicCharacterImageUrl } from './public-character-image'

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
    const resolved = resolvePublicCharacterImageUrl(null, 'portrait.starter.wayfarer-07')
    expect(resolved).toMatch(/^\/media\//)
    expect(resolved).toMatch(/\.webp$/)
  })

  it('returns no public image for an invalid portrait reference', () => {
    expect(resolvePublicCharacterImageUrl(null, 'portrait.invalid')).toBeNull()
  })
})
