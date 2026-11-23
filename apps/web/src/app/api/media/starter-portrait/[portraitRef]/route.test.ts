import { describe, expect, it } from 'vitest'
import { resolvePublicCharacterImageUrl } from '@/media/public-character-portrait'
import { GET } from './route'

describe('starter portrait media route', () => {
  it('redirects the published replacement URL to its versioned WebP and revalidates the mutable alias', async () => {
    const portraitRef = 'portrait.starter.wayfarer-07'
    const url = new URL(resolvePublicCharacterImageUrl(null, portraitRef)!, 'https://aurevane.test')
    const response = await GET(new Request(url), { params: Promise.resolve({ portraitRef }) })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://aurevane.test/media/art/wayfarer/portrait-07-v02.webp',
    )
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    expect(url.searchParams.get('v')).toBe('wayfarer-v02')
  })

  it('revalidates existing unversioned aliases and serves the unchanged first portrait bytes', async () => {
    const response = await GET(new Request('https://aurevane.test'), {
      params: Promise.resolve({ portraitRef: 'portrait.starter.wayfarer-01' }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0)
  })

  it('keeps Adventure portrait destinations unchanged with explicit redirect cache headers', async () => {
    const response = await GET(new Request('https://aurevane.test'), {
      params: Promise.resolve({ portraitRef: 'portrait.adventure.male-01' }),
    })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://aurevane.test/media/art/adventure/male-01-v01.webp',
    )
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
