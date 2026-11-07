import { AurevaneError } from '@aurevane/game-core/errors'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  APPEARANCE_PRESETS,
  appearanceManifestFromImageUrl,
} from '@/appearance/appearance-manifest'

const mocks = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  findNpcAppearanceConflicts: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: 'verified' }),
}))
vi.mock('@/server/master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => mocks,
}))
vi.mock('@/server/master/npc-design-store', () => ({
  findNpcAppearanceConflicts: mocks.findNpcAppearanceConflicts,
}))

import * as route from './route'

const base = APPEARANCE_PRESETS[1].blueprint
const body = { count: 4, base, vary: ['body', 'hair', 'coat', 'sleeves'], mode: 'distinct' }
function request(payload: unknown) {
  return new Request('http://localhost/api/master/npc-design/variants', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireCapability.mockResolvedValue({ roles: ['content-staff'] })
  mocks.findNpcAppearanceConflicts.mockResolvedValue([])
})

it('returns only compatible, private and distinct previews while preserving shared features', async () => {
  const response = await route.POST(request(body))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  const { candidates } = (await response.json()) as { candidates: string[] }
  expect(new Set(candidates).size).toBe(4)
  for (const candidate of candidates) {
    const blueprint = appearanceManifestFromImageUrl(candidate)?.blueprint
    expect(blueprint).toBeDefined()
    expect(blueprint).toMatchObject({ palette: 'indigo', accessory: 'brooch', hairColor: 'onyx' })
    expect(blueprint?.coat === 'plate' && blueprint.sleeves === 'puffed').toBe(false)
  }
  expect(mocks.requireCapability).toHaveBeenCalledWith('verified', 'npc.manage')
})

it('excludes already published looks and refuses an incomplete batch', async () => {
  mocks.findNpcAppearanceConflicts.mockImplementation(async (_actor, choices: string[]) =>
    choices.slice(0, 1),
  )
  // With four hair colors, the base excluded, and one published match, only two remain.
  const response = await route.POST(request({ ...body, count: 3, vary: ['hairColor'] }))
  expect(response.status).toBe(400)
  expect(await response.json()).not.toHaveProperty('candidates')
})

it('rejects oversized and forged requests before checking any active looks', async () => {
  expect((await route.POST(request({ ...body, count: 9 }))).status).toBe(400)
  expect((await route.POST(request({ ...body, vary: ['palette', 'palette'] }))).status).toBe(400)
  expect((await route.POST(request({ ...body, actorUserId: 'forged' }))).status).toBe(400)
  expect(
    (await route.POST(request({ ...body, base: { ...base, sleeves: 'puffed' } }))).status,
  ).toBe(400)
  expect(mocks.findNpcAppearanceConflicts).not.toHaveBeenCalled()
})

it('blocks unauthorized previews and reserves exact-copy previews for the Game Owner', async () => {
  const uniform = { ...body, vary: [], mode: 'uniform' }
  expect((await route.POST(request(uniform))).status).toBe(403)
  mocks.requireCapability.mockRejectedValueOnce(
    new AurevaneError('FORBIDDEN', 'No NPC Design access'),
  )
  expect((await route.POST(request(body))).status).toBe(403)
  mocks.requireCapability.mockResolvedValueOnce({ roles: ['game-owner'] })
  const response = await route.POST(request(uniform))
  expect(response.status).toBe(200)
  const { candidates } = (await response.json()) as { candidates: string[] }
  expect(candidates).toHaveLength(4)
  expect(new Set(candidates).size).toBe(1)
  expect(appearanceManifestFromImageUrl(candidates[0])?.blueprint).toEqual(base)
  expect(mocks.findNpcAppearanceConflicts).not.toHaveBeenCalled()
})
