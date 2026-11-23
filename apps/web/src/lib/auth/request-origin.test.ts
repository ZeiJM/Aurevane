import { describe, expect, it } from 'vitest'

import { getAuthRequestOrigin } from './request-origin'

describe('auth request origin behind Next.js', () => {
  it('keeps the incoming loopback host when Next uses its internal localhost URL', () => {
    expect(
      getAuthRequestOrigin(
        new Request('http://localhost:3100/auth/callback', { headers: { Host: '127.0.0.1:3100' } }),
      ),
    ).toBe('http://127.0.0.1:3100')
  })

  it('preserves an ordinary same-host request', () => {
    expect(
      getAuthRequestOrigin(
        new Request('https://aurevane.test/auth/callback', { headers: { Host: 'aurevane.test' } }),
      ),
    ).toBe('https://aurevane.test')
  })

  it('allows a configured hosted domain with the request protocol', () => {
    expect(
      getAuthRequestOrigin(
        new Request('https://localhost/auth/callback', { headers: { Host: 'aurevane.test' } }),
        ['aurevane.test'],
      ),
    ).toBe('https://aurevane.test')
  })

  it('does not trust forwarded host headers', () => {
    expect(
      getAuthRequestOrigin(
        new Request('https://aurevane.test/auth/callback', {
          headers: { Host: 'aurevane.test', 'X-Forwarded-Host': 'evil.test' },
        }),
      ),
    ).toBe('https://aurevane.test')
  })

  it.each([
    'evil.test',
    '127.0.0.1:3200',
    'localhost:3100@evil.test',
    'localhost:3100/path',
    'localhost:3100\\evil.test',
  ])('rejects an unrelated or malformed host: %s', (host) => {
    expect(
      getAuthRequestOrigin(
        new Request('http://localhost:3100/auth/callback', { headers: { Host: host } }),
        [],
      ),
    ).toBeNull()
  })
})
