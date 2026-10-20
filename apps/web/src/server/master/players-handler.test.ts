import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { AurevaneError } from '@aurevane/game-core/errors'
import { handleMasterPlayersRequest } from './players-handler'
import { createMasterPlayersService } from './players-service'
const id = '00000000-0000-4000-8000-000000000001'
const post = (value: unknown) =>
  new Request('http://localhost/api/master/players', {
    method: 'POST',
    body: JSON.stringify(value),
  })
function fixture(owner = true) {
  const rpc = vi.fn(async () => [])
  const service = createMasterPlayersService(
    {
      requireCapability: async () => {
        if (!owner) throw new AurevaneError('FORBIDDEN', 'Owner required')
        return {
          userId: id,
          roles: ['game-owner'],
          effectiveCapabilities: ['staff.manage'],
          specialCapabilities: [],
          accessVersion: 1,
        }
      },
    },
    rpc,
  )
  return {
    rpc,
    dependencies: { getActor: async () => ({ userId: id }), createService: () => service },
  }
}
it('serves bounded neutral search with private no-store and authenticated actor', async () => {
  const f = fixture()
  const response = await handleMasterPlayersRequest(
    post({ operation: 'search', query: 'Target' }),
    f.dependencies,
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(f.rpc).toHaveBeenCalledWith('search_master_players_v1', {
    p_actor_user_id: id,
    p_query: 'Target',
  })
})
it('denies non-Owner protected reads before database call', async () => {
  const f = fixture(false)
  const response = await handleMasterPlayersRequest(
    post({ operation: 'read', characterId: id }),
    f.dependencies,
  )
  expect(response.status).toBe(403)
  expect(f.rpc).not.toHaveBeenCalled()
})
it.each([
  { operation: 'search', query: 'Target', actorUserId: id },
  { operation: 'search', query: 'T' },
  { operation: 'read', characterId: 'bad' },
  {
    operation: 'edit',
    characterId: id,
    requestKey: id,
    fingerprint: 'f'.repeat(64),
    command: { kind: 'support', supportActionId: 'basic.guard' },
  },
  {
    operation: 'recover',
    characterId: id,
    battleSessionId: id,
    requestKey: id,
    expectedVersion: 1,
    participantIds: [id, id],
    confirmed: true,
  },
  {
    operation: 'recover',
    characterId: id,
    battleSessionId: id,
    requestKey: id,
    expectedVersion: 1,
    participantIds: [id],
    confirmed: true,
    terminalSnapshot: {},
  },
])('rejects forged authority, missing confirmation and malformed selection', async (body) => {
  const f = fixture()
  const response = await handleMasterPlayersRequest(post(body), f.dependencies)
  expect(response.status).toBe(400)
  expect(f.rpc).not.toHaveBeenCalled()
})
