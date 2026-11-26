import { AurevaneError } from '@aurevane/game-core/errors'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  APPEARANCE_PRESETS,
  appearanceManifestFromImageUrl,
  paintedPlayerAppearanceBlueprint,
} from '@/appearance/appearance-manifest'
import { PAINTED_STUDIES } from '@/appearance/appearance-painted-studies'
import { isActivePaintedAppearance } from '@/appearance/appearance-active-catalog'

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

const base = paintedPlayerAppearanceBlueprint(PAINTED_STUDIES.f32.look)
const body = { count: 4, base, vary: ['backdrop', 'clothColor'], mode: 'distinct' }
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
    expect(isActivePaintedAppearance(blueprint)).toBe(true)
    expect(blueprint).toMatchObject({ faceId: 'f32', hairstyle: 'layers', outerwear: 'pine' })
  }
  expect(mocks.requireCapability).toHaveBeenCalledWith('verified', 'npc.manage')
})

it('excludes already published looks and refuses an incomplete batch', async () => {
  mocks.findNpcAppearanceConflicts.mockImplementation(async (_actor, choices: string[]) =>
    choices.slice(0, -2),
  )
  const response = await route.POST(request({ ...body, count: 3, vary: ['backdrop'] }))
  expect(response.status).toBe(400)
  expect(await response.json()).not.toHaveProperty('candidates')
})

it('rejects retired recipes and fields that would fall back to older art', async () => {
  const retired = APPEARANCE_PRESETS[1].blueprint
  const cassian = paintedPlayerAppearanceBlueprint(PAINTED_STUDIES.m02.look)
  for (const selection of [
    { base: retired },
    { vary: ['hairstyle'] },
    { base: cassian, vary: ['clothColor'] },
  ]) {
    expect((await route.POST(request({ ...body, ...selection }))).status).toBe(400)
  }
  expect(mocks.findNpcAppearanceConflicts).not.toHaveBeenCalled()
})

it('rejects oversized and forged requests before checking any active looks', async () => {
  expect((await route.POST(request({ ...body, count: 9 }))).status).toBe(400)
  expect((await route.POST(request({ ...body, vary: ['backdrop', 'backdrop'] }))).status).toBe(400)
  expect((await route.POST(request({ ...body, actorUserId: 'forged' }))).status).toBe(400)
  expect(
    (await route.POST(request({ ...body, base: { ...base, hairstyle: 'natural' } }))).status,
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
