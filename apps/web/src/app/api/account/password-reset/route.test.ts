import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}))
const cookieStore = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }))
vi.mock('@/server/account/account-services-readiness', () => ({
  getCurrentAccountServicesReadiness: () => ({ available: true }),
}))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ auth }) }))

import { POST } from './route'

function request(
  body = { password: 'New-password-2026!', confirmPassword: 'New-password-2026!' },
  origin = 'https://aurevane.test',
) {
  return new Request('https://aurevane.test/api/account/password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  })
}

describe('recovery password update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email_confirmed_at: '2026-01-01' } },
      error: null,
    })
    auth.updateUser.mockResolvedValue({ error: null })
    auth.signOut.mockResolvedValue({ error: null })
    auth.getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', session_id: 'recovery-session' } },
      error: null,
    })
    cookieStore.get.mockReturnValue({ value: 'recovery-session' })
  })

  it('verifies the user, updates the password, and signs out before returning sign-in', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ redirectTo: '/?account=password-reset' })
    expect(auth.getUser).toHaveBeenCalledOnce()
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'New-password-2026!' })
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(cookieStore.delete).toHaveBeenCalledWith('aurevane-password-recovery')
    expect(auth.getUser.mock.invocationCallOrder[0]).toBeLessThan(
      auth.updateUser.mock.invocationCallOrder[0]!,
    )
    expect(auth.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      auth.signOut.mock.invocationCallOrder[0]!,
    )
  })

  it('accepts the same browser origin when Next supplies an internal localhost URL', async () => {
    const response = await POST(
      new Request('http://localhost:3100/api/account/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Host: '127.0.0.1:3100',
          Origin: 'http://127.0.0.1:3100',
        },
        body: JSON.stringify({
          password: 'New-password-2026!',
          confirmPassword: 'New-password-2026!',
        }),
      }),
    )
    expect(response.status).toBe(200)
    expect(auth.updateUser).toHaveBeenCalledOnce()
  })

  it('still rejects a foreign Origin with a valid browser Host', async () => {
    const response = await POST(
      new Request('http://localhost:3100/api/account/password-reset', {
        method: 'POST',
        headers: { Host: '127.0.0.1:3100', Origin: 'https://evil.test' },
      }),
    )
    expect(response.status).toBe(403)
    expect(auth.getUser).not.toHaveBeenCalled()
  })

  it.each([null, { id: 'user-1' }])(
    'rejects absent or unconfirmed verified users',
    async (user) => {
      auth.getUser.mockResolvedValue({ data: { user }, error: null })
      expect((await POST(request())).status).toBe(401)
      expect(auth.updateUser).not.toHaveBeenCalled()
    },
  )

  it('rejects a revoked recovery session even if cookies still exist', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } })
    expect((await POST(request())).status).toBe(401)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it.each([
    { password: 'short', confirmPassword: 'short' },
    { password: 'New-password-2026!', confirmPassword: 'Mismatch' },
  ])('rejects invalid password submissions before changing auth state', async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('rejects cross-origin requests', async () => {
    expect((await POST(request(undefined, 'https://evil.test'))).status).toBe(403)
    expect(auth.getUser).not.toHaveBeenCalled()
  })

  it('rejects an ordinary authenticated session without recovery evidence', async () => {
    cookieStore.get.mockReturnValue(undefined)
    expect((await POST(request())).status).toBe(401)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('rejects a marker belonging to a previous login', async () => {
    cookieStore.get.mockReturnValue({ value: 'previous-session' })
    expect((await POST(request())).status).toBe(401)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('keeps provider failures generic and permits retry', async () => {
    auth.updateUser.mockResolvedValue({
      error: { message: 'private provider detail', code: 'weak_password' },
    })
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(JSON.stringify(await response.json())).not.toContain('private provider detail')
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('does not report completed recovery when sign-out fails after the update', async () => {
    auth.signOut.mockResolvedValue({ error: { message: 'unavailable' } })
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error:
        'Your password changed, but sign-out could not finish. Try signing out before signing in again.',
    })
    expect(cookieStore.delete).not.toHaveBeenCalled()
  })
})
