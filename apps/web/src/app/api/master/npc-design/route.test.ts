import { AurevaneError } from '@aurevane/game-core/errors'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  writeNpcDesign: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: 'verified' }),
}))
vi.mock('@/server/master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => mocks,
}))
vi.mock('@/server/master/npc-design-store', () => ({ writeNpcDesign: mocks.writeNpcDesign }))

import { POST } from './route'

const body = {
  kind: 'save',
  id: '39076058-5dba-457a-899c-d57b958540ca',
  revision: 0,
  draft: {
    name: 'Arena Fixture',
    portraitRef: null,
    uses: ['arena'],
    arena: { arenaId: 'duel-yard', aiDifficulty: 'high', lore: '' },
  },
}
function request(data: unknown = body) {
  return new Request('http://localhost/api/master/npc-design', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.writeNpcDesign.mockResolvedValue({ id: body.id, revision: 1 })
})
it('allows the verified NPC Design actor to save an arena-only NPC', async () => {
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(mocks.requireCapability).toHaveBeenCalledWith('verified', 'npc.manage')
  expect(mocks.writeNpcDesign).toHaveBeenCalledWith('verified', body)
})
it('denies direct requests from actors without NPC Design access', async () => {
  mocks.requireCapability.mockRejectedValue(new AurevaneError('FORBIDDEN', 'No NPC Design access'))
  expect((await POST(request())).status).toBe(403)
  expect(mocks.writeNpcDesign).not.toHaveBeenCalled()
})
it('rejects caller-provided actor identity and malformed arena assignments', async () => {
  expect((await POST(request({ ...body, actorUserId: 'forged' }))).status).toBe(400)
  expect((await POST(request({ ...body, draft: { ...body.draft, arena: null } }))).status).toBe(400)
  expect(mocks.writeNpcDesign).not.toHaveBeenCalled()
})

it('requires explicit approval from the Game Owner to publish an exact copy', async () => {
  const command = {
    kind: 'commit-uniform',
    id: body.id,
    revision: 1,
    use: 'arena',
    reason: 'Ceremonial doubles',
  }
  mocks.requireCapability.mockResolvedValue({ roles: ['content-staff'] })
  expect((await POST(request(command))).status).toBe(403)
  expect(mocks.writeNpcDesign).not.toHaveBeenCalled()
  mocks.requireCapability.mockResolvedValue({ roles: ['game-owner'] })
  expect((await POST(request({ ...command, reason: '  ' }))).status).toBe(400)
  expect((await POST(request({ ...command, use: 'arena-and-world' }))).status).toBe(400)
  expect((await POST(request(command))).status).toBe(200)
  expect(mocks.writeNpcDesign).toHaveBeenCalledExactlyOnceWith('verified', command)
})
