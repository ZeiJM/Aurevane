import { AurevaneError } from '@aurevane/game-core/errors'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  requireCapability: vi.fn(),
  readPublishedStoryNpcs: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: mocks.getActor }))
vi.mock('@/server/master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => mocks,
}))
vi.mock('@/server/master/npc-design-store', () => ({
  readPublishedStoryNpcs: mocks.readPublishedStoryNpcs,
}))

import { GET } from './route'

const publishedStory = {
  id: '39076058-5dba-457a-899c-d57b958540ca',
  name: 'Story fixture',
  portraitRef: null,
  revision: 1,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getActor.mockResolvedValue({ userId: 'verified-author' })
  mocks.readPublishedStoryNpcs.mockResolvedValue([publishedStory])
})

it('gives Event authors the published Story catalogue with a private response', async () => {
  const response = await GET()
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ npcs: [publishedStory] })
  expect(mocks.requireCapability).toHaveBeenCalledWith('verified-author', 'events.author')
  expect(mocks.readPublishedStoryNpcs).toHaveBeenCalledWith('verified-author')
})

it('denies direct reads without Event authoring access before looking up any NPC', async () => {
  mocks.requireCapability.mockRejectedValue(new AurevaneError('FORBIDDEN', 'No Event access.'))
  expect((await GET()).status).toBe(403)
  expect(mocks.readPublishedStoryNpcs).not.toHaveBeenCalled()
})
