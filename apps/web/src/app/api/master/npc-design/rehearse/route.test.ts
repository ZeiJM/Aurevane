import { AurevaneError } from '@aurevane/game-core/errors'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  readNpcDesigns: vi.fn(),
  rehearseNpcArenaTurn: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: 'verified' }),
}))
vi.mock('@/server/master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => mocks,
}))
vi.mock('@/server/master/npc-design-store', () => ({ readNpcDesigns: mocks.readNpcDesigns }))
vi.mock('@/server/master/npc-arena-rehearsal', () => ({
  rehearseNpcArenaTurn: mocks.rehearseNpcArenaTurn,
}))

import { POST } from './route'

const record = { id: '50696907-bb48-44c8-bd35-3ebd5842d89d', revision: 3 }
function request(data: unknown = record) {
  return new Request('http://localhost/api/master/npc-design/rehearse', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.readNpcDesigns.mockResolvedValue([record])
  mocks.rehearseNpcArenaTurn.mockResolvedValue({ decisions: [] })
})
it('resolves the saved NPC after checking authorization and the exact draft revision', async () => {
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(mocks.requireCapability).toHaveBeenCalledWith('verified', 'npc.manage')
  expect(mocks.readNpcDesigns).toHaveBeenCalledWith('verified')
  expect(mocks.rehearseNpcArenaTurn).toHaveBeenCalledWith(record)
})
it('blocks forged combat payloads, stale drafts and unprivileged requests', async () => {
  expect((await POST(request({ ...record, combat: 'forged' }))).status).toBe(400)
  expect((await POST(request({ ...record, revision: 2 }))).status).toBe(409)
  mocks.requireCapability.mockRejectedValue(new AurevaneError('FORBIDDEN', 'No NPC Design access'))
  expect((await POST(request())).status).toBe(403)
  expect(mocks.rehearseNpcArenaTurn).not.toHaveBeenCalled()
})
