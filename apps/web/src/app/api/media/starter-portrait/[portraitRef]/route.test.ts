import { describe, expect, it } from 'vitest'

import { GET } from './route'

describe('starter portrait media route', () => {
  it('serves a registered starter portrait as an immutable WebP', async () => {
    const response = await GET(new Request('https://aurevane.test'), {
      params: Promise.resolve({ portraitRef: 'portrait.starter.wayfarer-07' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('cache-control')).toContain('immutable')
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0)
  })

  it('fails closed for an unknown portrait reference', async () => {
    const response = await GET(new Request('https://aurevane.test'), {
      params: Promise.resolve({ portraitRef: 'portrait.invalid' }),
    })

    expect(response.status).toBe(404)
  })
})
