import { AurevaneError } from '@aurevane/game-core/errors'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  requireCapability: vi.fn(),
  readPublishedWorldNpcs: vi.fn(),
  readPublishedRestorationTrialNpc: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: mocks.getActor }))
vi.mock('@/server/master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => mocks,
}))
vi.mock('@/server/master/npc-design-store', () => ({
  readPublishedWorldNpcs: mocks.readPublishedWorldNpcs,
  readPublishedRestorationTrialNpc: mocks.readPublishedRestorationTrialNpc,
}))

import { GET } from './route'

const sectorId = 'verdant-expanse'
const sentinel = {
  id: '39076058-5dba-457a-899c-d57b958540ca',
  name: 'Forge Sentinel',
  sectorId,
  x: 3,
  y: 4,
  greeting: 'The World greeting',
  encounter: { arenaId: 'duel-yard', aiDifficulty: 'high', tags: [] },
}

function request(sector = sectorId) {
  return new Request(
    `https://example.test/api/master/events/restoration-trial-npcs?sectorId=${sector}`,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getActor.mockResolvedValue({ userId: 'verified-author' })
  mocks.readPublishedWorldNpcs.mockResolvedValue([
    sentinel,
    { ...sentinel, id: 'ec9f4cb3-d9f7-4d34-a9d8-a1f1a7c6d0f9', encounter: null },
    { ...sentinel, id: 'dca0a5cc-282d-4fbb-aec8-5b57726fc29e', x: 10, y: 0 },
  ])
})

it('returns only the identity of committed encounters on walkable World cells', async () => {
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ npcs: [{ id: sentinel.id, name: sentinel.name }] })
  expect(mocks.requireCapability).toHaveBeenCalledWith('verified-author', 'events.author')
  expect(mocks.readPublishedWorldNpcs).toHaveBeenCalledWith(sectorId)
})

it('lists unique tags from eligible encounters in the selected World sector', async () => {
  const tags = (values: string[]) => ({ ...sentinel.encounter, tags: values })
  mocks.readPublishedWorldNpcs.mockResolvedValue([
    { ...sentinel, encounter: tags(['wolf', 'ashbound-raider']) },
    { ...sentinel, encounter: tags(['wolf']) },
    { ...sentinel, encounter: null },
    { ...sentinel, x: 10, y: 0, encounter: tags(['unreachable']) },
  ])
  const response = await GET(new Request(`${request().url}&view=tags`))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ tags: ['ashbound-raider', 'wolf'] })
  expect(mocks.requireCapability).toHaveBeenCalledWith('verified-author', 'events.author')
  expect(mocks.readPublishedWorldNpcs).toHaveBeenCalledExactlyOnceWith(sectorId)
})

it('requires one charted sector for tag browsing', async () => {
  const endpoint = new URL(request().url)
  endpoint.search = 'view=tags'
  expect((await GET(new Request(endpoint))).status).toBe(400)
  expect((await GET(new Request(`${request('missing-sector').url}&view=tags`))).status).toBe(400)
  expect((await GET(new Request(`${request().url}&view=tags&npcId=${sentinel.id}`))).status).toBe(
    400,
  )
  expect(mocks.readPublishedWorldNpcs).not.toHaveBeenCalled()
})

it('rejects unknown sectors without looking up NPCs', async () => {
  expect((await GET(request('missing-sector'))).status).toBe(400)
  expect(mocks.readPublishedWorldNpcs).not.toHaveBeenCalled()
})

it('rejects direct reads from accounts without Events authoring access', async () => {
  mocks.requireCapability.mockRejectedValue(new AurevaneError('FORBIDDEN', 'No Event access.'))
  expect((await GET(request())).status).toBe(403)
  expect((await GET(new Request(`${request().url}&view=tags`))).status).toBe(403)
  expect(mocks.readPublishedWorldNpcs).not.toHaveBeenCalled()
})

it('provides only charted sector identities and labels when no sector has been selected', async () => {
  const response = await GET(
    new Request('https://example.test/api/master/events/restoration-trial-npcs'),
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    sectors: expect.arrayContaining([
      { id: sectorId, name: expect.stringMatching(/Verdant Expanse/) },
    ]),
  })
  expect(mocks.readPublishedWorldNpcs).not.toHaveBeenCalled()
})

function npcRequest(npcId = sentinel.id) {
  return new Request(`https://example.test/api/master/events/restoration-trial-npcs?npcId=${npcId}`)
}

it('restores a saved encounter by ID with its committed sector and minimal identity', async () => {
  mocks.readPublishedRestorationTrialNpc.mockResolvedValue({ ...sentinel, sectorId: 'emberreach' })
  const response = await GET(npcRequest())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toEqual({
    npc: { id: sentinel.id, name: sentinel.name, sectorId: 'emberreach' },
  })
  expect(mocks.readPublishedRestorationTrialNpc).toHaveBeenCalledExactlyOnceWith(
    'verified-author',
    sentinel.id,
  )
  expect(mocks.readPublishedWorldNpcs).not.toHaveBeenCalled()
})

it.each([null, { ...sentinel, x: 10, y: 0 }])(
  'returns no eligible identity for a retired or unwalkable saved encounter',
  async (npc) => {
    mocks.readPublishedRestorationTrialNpc.mockResolvedValue(npc)
    const response = await GET(npcRequest())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ npc: null })
  },
)

it('does not query a saved encounter for unauthorized authors or invalid IDs', async () => {
  expect((await GET(npcRequest('malformed'))).status).toBe(400)
  mocks.requireCapability.mockRejectedValue(new AurevaneError('FORBIDDEN', 'No Event access.'))
  expect((await GET(npcRequest())).status).toBe(403)
  expect(mocks.readPublishedRestorationTrialNpc).not.toHaveBeenCalled()
})
