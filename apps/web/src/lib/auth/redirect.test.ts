import { describe, expect, it } from 'vitest'

import { getSafeInternalRedirect } from './redirect'

describe('getSafeInternalRedirect', () => {
  it('allows an internal application path', () => {
    expect(getSafeInternalRedirect('/account?tab=security')).toBe('/account?tab=security')
  })

  it('rejects absolute external URLs', () => {
    expect(getSafeInternalRedirect('https://example.com/phish')).toBe('/')
  })

  it('rejects protocol-relative URLs', () => {
    expect(getSafeInternalRedirect('//example.com/phish')).toBe('/')
  })

  it('uses a caller-provided fallback when the redirect is absent', () => {
    expect(getSafeInternalRedirect(null, '/home')).toBe('/home')
  })
})
