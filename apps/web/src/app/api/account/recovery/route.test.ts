import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({ verifyOtp: vi.fn(), getUser: vi.fn(), getClaims: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: mocked }),
}))
vi.mock('@/lib/supabase/config', () => ({ getOptionalPublicSupabaseConfig: () => null }))
vi.mock('@/server/account/account-services-readiness', () => ({
  getCurrentAccountServicesReadiness: () => ({ available: true }),
}))

import { POST } from './route'

const tokenHash = 'a-valid-opaque-recovery-token-hash'
function request(body: unknown = { tokenHash }, origin = 'https://aurevane.test') {
  return new Request('https://aurevane.test/api/account/recovery', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('explicit email recovery verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.verifyOtp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { user: { id: 'user-1' } } },
      error: null,
    })
    mocked.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email_confirmed_at: 'confirmed' } },
      error: null,
    })
    mocked.getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', session_id: 'session-1' } },
      error: null,
    })
  })

  it('verifies only recovery and binds the HttpOnly marker to the verified session', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ redirectTo: '/auth/reset-password' })
    expect(mocked.verifyOtp).toHaveBeenCalledWith({ token_hash: tokenHash, type: 'recovery' })
    const cookie = response.headers.get('set-cookie')
    expect(cookie).toContain('aurevane-password-recovery=session-1')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('rejects a foreign origin before contacting Auth', async () => {
    expect((await POST(request({ tokenHash }, 'https://evil.test'))).status).toBe(403)
    expect(mocked.verifyOtp).not.toHaveBeenCalled()
  })

  it.each([
    {},
    { tokenHash: 'short' },
    { tokenHash, type: 'signup' },
    { tokenHash, next: 'https://evil.test' },
    { tokenHash: 'a'.repeat(257) },
    { tokenHash: 'https://evil.test/token' },
  ])('rejects malformed or non-recovery transport: %j', async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(mocked.verifyOtp).not.toHaveBeenCalled()
  })

  it('does not grant recovery when verification fails or a token is replayed', async () => {
    mocked.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'private provider detail' },
    })
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(JSON.stringify(await response.json())).not.toContain('private provider detail')
  })

  it.each(['claims', 'user', 'session'])(
    'rejects mismatched verified %s identity',
    async (part) => {
      if (part === 'claims')
        mocked.getClaims.mockResolvedValue({
          data: { claims: { sub: 'other', session_id: 'session-1' } },
          error: null,
        })
      if (part === 'user')
        mocked.getUser.mockResolvedValue({
          data: { user: { id: 'other', email_confirmed_at: 'confirmed' } },
          error: null,
        })
      if (part === 'session')
        mocked.verifyOtp.mockResolvedValue({
          data: { user: { id: 'user-1' }, session: { user: { id: 'other' } } },
          error: null,
        })
      const response = await POST(request())
      expect(response.status).toBe(401)
      expect(response.headers.get('set-cookie')).toBeNull()
    },
  )
})
