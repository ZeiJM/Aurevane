import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('./staff-access-server', () => ({ createServerMasterPanelStaffAccessService: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: vi.fn() }))
vi.mock('./selected-character-rpc', () => ({ createSelectedCharacterRpc: vi.fn() }))
import { handleDisciplinePlayerGrants } from './discipline-player-grants'
const user = '00000000-0000-4000-8000-000000000001'
const request = (body: unknown) =>
  new Request('http://localhost/api/master/discipline-player-grants', {
    method: 'POST',
    body: JSON.stringify(body),
  })
it.each([
  ['DISCIPLINE_GRANT_UNAVAILABLE', /Discipline.*disabled.*Enable.*Commit Now/],
  ['DISCIPLINE_GRANT_RECIPIENT_UNAVAILABLE', /player.*unavailable.*Search/i],
] as const)(
  'explains the action needed for %s without echoing database details',
  async (message, help) => {
    const response = await handleDisciplinePlayerGrants(
      request({
        operation: 'grant',
        disciplineId: 'runeblade',
        accountIds: [user],
        reason: 'Testing',
      }),
      {
        getActor: async () => ({ userId: user }),
        requireAccess: async () => undefined,
        rpc: async () => ({ data: null, error: { message } }),
      },
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.message).toMatch(help)
    expect(body.error.message).not.toContain('DISCIPLINE_GRANT_')
  },
)
it('uses authenticated actor and stable verified IDs, deduplicates a batch', async () => {
  const rpc = vi.fn(async () => ({ data: { changed: 1 }, error: null }))
  const requireAccess = vi.fn(async () => undefined)
  const response = await handleDisciplinePlayerGrants(
    request({
      operation: 'grant',
      disciplineId: 'vanguard',
      accountIds: [user, user],
      reason: ' Approved ',
    }),
    { getActor: async () => ({ userId: user }), requireAccess, rpc },
  )
  expect(response.status).toBe(200)
  expect(requireAccess).toHaveBeenCalledWith(user)
  expect(rpc).toHaveBeenCalledWith('write_discipline_player_grants_v1', {
    p_actor_user_id: user,
    p_discipline_id: 'vanguard',
    p_account_ids: [user],
    p_action: 'grant',
    p_reason: 'Approved',
  })
})
it.each([
  { operation: 'grant', disciplineId: 'vanguard', accountIds: ['Player Name'], reason: 'reason' },
  { operation: 'grant', disciplineId: 'vanguard', accountIds: [user], reason: ' ' },
  { operation: 'search', query: 'Player', actorUserId: user },
  { operation: 'read', disciplineId: 'vanguard', after: 'wrong' },
])('rejects unsupported or spoofed intent %j', async (body) => {
  const rpc = vi.fn(async () => ({ data: null, error: null }))
  const response = await handleDisciplinePlayerGrants(request(body), {
    getActor: async () => ({ userId: user }),
    requireAccess: async () => undefined,
    rpc,
  })
  expect(response.status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
})
