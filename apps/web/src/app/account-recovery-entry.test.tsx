import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  marker: vi.fn(),
  getClaims: vi.fn(),
  ensure: vi.fn(),
  redirect: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => 'aurevane.test' }),
  cookies: async () => ({ get: mocked.marker }),
}))
vi.mock('next/navigation', () => ({ redirect: mocked.redirect }))
vi.mock('@/components/account/account-entry-shell', () => ({ AccountEntryShell: () => null }))
vi.mock('@/lib/supabase/auth', () => ({ getVerifiedAuthClaims: mocked.getClaims }))
vi.mock('@/lib/supabase/config', () => ({
  getOptionalPublicSupabaseConfig: () => ({
    url: 'http://127.0.0.1:54321',
    publishableKey: 'local',
  }),
}))
vi.mock('@/server/account/account-services-readiness', () => ({
  getCurrentAccountServicesReadiness: () => ({ available: true }),
}))
vi.mock('@/server/account/active-game-session', () => ({
  ensureActiveGameSession: mocked.ensure,
  readVerifiedGameSessionIdentity: () => ({ userId: 'user-1', authSessionId: 'session-1' }),
}))

import Home from './page'

describe('account entry during password recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.getClaims.mockResolvedValue({ sub: 'user-1', session_id: 'session-1' })
    mocked.ensure.mockResolvedValue(true)
    mocked.marker.mockReturnValue({ value: 'session-1' })
  })

  it('keeps a recovery retry on account entry without creating or claiming gameplay', async () => {
    const page = await Home({ searchParams: Promise.resolve({ account: 'recovery' }) })
    expect(page.props.initialRecovery).toBe(true)
    expect(mocked.ensure).not.toHaveBeenCalled()
    expect(mocked.redirect).not.toHaveBeenCalled()
  })

  it('keeps back-to-sign-in on account entry while the recovery session remains active', async () => {
    await Home({ searchParams: Promise.resolve({}) })
    expect(mocked.ensure).not.toHaveBeenCalled()
    expect(mocked.redirect).not.toHaveBeenCalled()
  })

  it('preserves normal authenticated entry when the marker belongs to a prior session', async () => {
    mocked.marker.mockReturnValue({ value: 'prior-session' })
    await Home({ searchParams: Promise.resolve({}) })
    expect(mocked.ensure).toHaveBeenCalledOnce()
    expect(mocked.redirect).toHaveBeenCalledWith('/game')
  })
})
