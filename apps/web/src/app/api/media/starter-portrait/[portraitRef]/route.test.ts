import { describe, expect, it } from 'vitest'
import { resolvePublicCharacterImageUrl } from '@/media/public-character-portrait'
import { appearanceManifestFromImageUrl } from '@/appearance/appearance-manifest'
import { isActivePaintedAppearance } from '@/appearance/appearance-active-catalog'
import { GET } from './route'

describe('starter portrait media route', () => {
  it.each([
    'portrait.starter.wayfarer-07',
    'portrait.starter.wayfarer-01',
    'portrait.adventure.male-01',
  ])('resolves %s to approved art and revalidates the alias', async (portraitRef) => {
    const url = new URL(resolvePublicCharacterImageUrl(null, portraitRef)!, 'https://aurevane.test')
    const response = await GET(new Request(url), { params: Promise.resolve({ portraitRef }) })
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.origin).toBe(url.origin)
    expect(
      isActivePaintedAppearance(appearanceManifestFromImageUrl(location.pathname)?.blueprint),
    ).toBe(true)
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
  })

  it('fails closed for unknown references instead of allowing arbitrary redirect destinations', async () => {
    for (const portraitRef of [
      'portrait.invalid',
      '//external.test/image.webp',
      'portrait.starter.wayfarer-41',
    ]) {
      const response = await GET(new Request('https://aurevane.test'), {
        params: Promise.resolve({ portraitRef }),
      })
      expect(response.status).toBe(404)
      expect(response.headers.get('location')).toBeNull()
      expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    }
  })
})
