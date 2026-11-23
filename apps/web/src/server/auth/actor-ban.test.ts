import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const state = vi.hoisted(() => ({ rpc: vi.fn(), claims: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: state.rpc }) }))
vi.mock('@/lib/supabase/auth', () => ({ getVerifiedAuthClaims: state.claims }))
import { getAuthenticatedActor } from './actor'
import { claimActiveGameSession } from '@/server/account/active-game-session'
it('denies every common actor boundary for a banned account despite an already-verified JWT', async () => {
  const identity = { userId: 'verified-account', authSessionId: 'existing-jwt-session' }
  state.claims.mockResolvedValue({
    sub: identity.userId,
    session_id: identity.authSessionId,
    exp: 9999999999,
  })
  state.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'ACCOUNT_BANNED' } })
  await expect(getAuthenticatedActor()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  expect(state.rpc).toHaveBeenLastCalledWith('ensure_active_game_session_v1', {
    p_user_id: identity.userId,
    p_auth_session_id: identity.authSessionId,
  })
  await expect(claimActiveGameSession(identity)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  // Expiry/lift is decided by live SQL, never by a stale JWT metadata flag.
  state.rpc.mockResolvedValue({ data: true, error: null })
  await expect(getAuthenticatedActor()).resolves.toEqual({ userId: identity.userId })
})
