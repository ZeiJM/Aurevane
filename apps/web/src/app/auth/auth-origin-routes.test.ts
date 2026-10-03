import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({ claim: vi.fn(), signOut: vi.fn() }))
vi.mock('@/lib/supabase/auth', () => ({
  getVerifiedAuthClaims: async () => ({ sub: 'user', session_id: 'session' }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { signOut: mocked.signOut } }),
}))
vi.mock('@/server/account/active-game-session', () => ({
  claimActiveGameSession: mocked.claim,
  readVerifiedGameSessionIdentity: () => ({ userId: 'user', authSessionId: 'session' }),
}))

import { GET as claim } from './claim/route'
import { POST as signOut } from './signout/route'

describe('auth redirects preserve the browser origin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.signOut.mockResolvedValue({ error: null })
  })

  it('claims a normal confirmation and returns to the same browser host', async () => {
    const response = await claim(
      new Request('http://localhost:3100/auth/claim?next=/game', {
        headers: { Host: '127.0.0.1:3100' },
      }),
    )
    expect(mocked.claim).toHaveBeenCalledOnce()
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3100/game')
  })

  it('rejects external next paths after a valid claim', async () => {
    const response = await claim(
      new Request('http://localhost:3100/auth/claim?next=https://evil.test', {
        headers: { Host: '127.0.0.1:3100' },
      }),
    )
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3100/')
  })

  it('returns sign-out to the browser host that owned the cookies', async () => {
    const response = await signOut(
      new Request('http://localhost:3100/auth/signout', {
        method: 'POST',
        headers: { Host: '127.0.0.1:3100' },
      }),
    )
    expect(response.status).toBe(303)
    expect(mocked.signOut).toHaveBeenCalledOnce()
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3100/')
  })

  it('does not claim a session for an unrecognized Host', async () => {
    const response = await claim(
      new Request('http://localhost:3100/auth/claim?next=/game', {
        headers: { Host: 'evil.test' },
      }),
    )
    expect(response.status).toBe(400)
    expect(mocked.claim).not.toHaveBeenCalled()
  })
})
