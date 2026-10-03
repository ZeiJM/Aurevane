import { beforeEach, describe, expect, it, vi } from 'vitest'

const { exchangeCodeForSession, getClaims } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getClaims: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession, getClaims } }),
}))

import { GET } from './route'

describe('authentication callback', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset()
    getClaims.mockResolvedValue({
      data: { claims: { session_id: 'recovery-session' } },
      error: null,
    })
  })

  it('keeps normal confirmation on the game-session claim path', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { redirectType: null }, error: null })
    const response = await GET(
      new Request('https://aurevane.test/auth/callback?code=ok&next=/game'),
    )
    expect(response.headers.get('location')).toBe('https://aurevane.test/auth/claim?next=%2Fgame')
  })

  it('keeps recovery on the browser host when Next supplies an internal localhost URL', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { redirectType: 'recovery' }, error: null })
    const response = await GET(
      new Request('http://localhost:3100/auth/callback?code=ok&next=/game', {
        headers: { Host: '127.0.0.1:3100' },
      }),
    )
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3100/auth/reset-password')
    expect(response.headers.get('set-cookie')).toContain(
      'aurevane-password-recovery=recovery-session',
    )
  })

  it('rejects a foreign Host before exchanging a code', async () => {
    const response = await GET(
      new Request('http://localhost:3100/auth/callback?code=ok&next=/game', {
        headers: { Host: 'evil.test' },
      }),
    )
    expect(response.status).toBe(400)
    expect(response.headers.get('location')).toBeNull()
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('routes verified recovery to password reset without claiming gameplay or honoring next', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { redirectType: 'recovery' }, error: null })
    const response = await GET(
      new Request(
        'https://aurevane.test/auth/callback?code=ok&flow=recovery&next=https://evil.test',
      ),
    )
    expect(response.headers.get('location')).toBe('https://aurevane.test/auth/reset-password')
    expect(response.headers.get('set-cookie')).toContain(
      'aurevane-password-recovery=recovery-session',
    )
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  })

  it('passes the provider PKCE flow identifier through the server exchange', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { redirectType: 'recovery' }, error: null })
    await GET(
      new Request('https://aurevane.test/auth/callback?code=ok&flow=recovery&sb_flow_id=123'),
    )
    expect(exchangeCodeForSession).toHaveBeenCalledWith('ok', { flowId: '123' })
  })

  it.each(['flow=recovery', 'flow=recovery&code=expired', 'flow=recovery&error=access_denied'])(
    'offers a retry for an invalid recovery link: %s',
    async (query) => {
      exchangeCodeForSession.mockResolvedValue({
        data: { redirectType: null },
        error: { message: 'expired' },
      })
      const response = await GET(new Request(`https://aurevane.test/auth/callback?${query}`))
      expect(response.headers.get('location')).toBe(
        'https://aurevane.test/auth/reset-password?error=invalid-link',
      )
    },
  )

  it('does not accept a normal sign-in code as a recovery callback', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { redirectType: null }, error: null })
    const response = await GET(
      new Request('https://aurevane.test/auth/callback?code=ok&flow=recovery'),
    )
    expect(response.headers.get('location')).toContain('error=invalid-link')
  })

  it.each(['next=/game', 'next=/game&error=access_denied', 'next=/game&code=expired'])(
    'provides a retry for the actual email redirect shape: %s',
    async (query) => {
      exchangeCodeForSession.mockResolvedValue({
        data: { redirectType: null },
        error: { message: 'expired' },
      })
      const response = await GET(new Request(`https://aurevane.test/auth/callback?${query}`))
      expect(response.headers.get('location')).toBe(
        'https://aurevane.test/auth/reset-password?error=invalid-link',
      )
    },
  )

  it('detects recovery from PKCE even on the existing signup redirect', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { redirectType: 'recovery' }, error: null })
    const response = await GET(
      new Request('https://aurevane.test/auth/callback?code=ok&next=/game'),
    )
    expect(response.headers.get('location')).toBe('https://aurevane.test/auth/reset-password')
  })

  it('provides a retry when account services cannot be reached', async () => {
    exchangeCodeForSession.mockRejectedValue(new Error('network'))
    const response = await GET(
      new Request('https://aurevane.test/auth/callback?code=ok&next=/game'),
    )
    expect(response.headers.get('location')).toContain('error=invalid-link')
  })
})
