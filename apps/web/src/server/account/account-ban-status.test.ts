import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const state = vi.hoisted(() => ({ claims: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/auth', () => ({ getVerifiedAuthClaims: state.claims }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: state.rpc }) }))
import { readSelfAccountBanStatus } from './account-ban-status'
import { GET } from '@/app/api/account/ban-status/route'
beforeEach(() => {
  state.claims.mockReset()
  state.rpc.mockReset()
})
const status = {
  active: true,
  permanent: true,
  expiresAt: null,
  reason: 'Reviewed conduct',
  serverTime: '2026-10-28T12:00:00Z',
}
it('uses only the verified subject, without a gameplay lease, and omits private moderation fields', async () => {
  state.claims.mockResolvedValue({ sub: 'verified-subject', session_id: 'session' })
  state.rpc.mockResolvedValue({
    data: { ...status, history: ['private'], userId: 'another' },
    error: null,
  })
  const response = await GET()
  expect(await response.json()).toEqual(status)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith('read_account_ban_status_v1', {
    p_user_id: 'verified-subject',
  })
})
it('rejects missing verified identity before a privileged call and does not treat malformed data as access', async () => {
  state.claims.mockResolvedValue(null)
  expect((await GET()).status).toBe(401)
  expect(state.rpc).not.toHaveBeenCalled()
  state.claims.mockResolvedValue({ sub: 'verified-subject', session_id: 'session' })
  state.rpc.mockResolvedValue({ data: { ...status, active: false }, error: null })
  await expect(readSelfAccountBanStatus()).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})
