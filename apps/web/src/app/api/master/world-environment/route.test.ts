import { beforeEach, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
vi.mock('server-only', () => ({}))
const { requireCapability, setEnvironment, readHistory } = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  setEnvironment: vi.fn(),
  readHistory: vi.fn(),
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: async () => ({ userId: 'owner' }) }))
vi.mock('@/server/master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => ({ requireCapability }),
}))
vi.mock('@/server/master/world-environment-admin-store', () => ({
  setWorldEnvironment: setEnvironment,
  readWorldEnvironmentAdminSettings: readHistory,
}))
import { GET, POST } from './route'

const change = {
  timeOffsetMinutes: 60,
  frozenMinuteOfDay: null,
  weather: 'rain',
  durationMinutes: 37,
  dayLengthMinutes: 120,
}
const request = (body: unknown) =>
  new Request('http://localhost/api/master/world-environment', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
beforeEach(() => {
  requireCapability.mockReset().mockResolvedValue({ roles: ['game-owner'] })
  setEnvironment.mockReset()
  readHistory.mockReset().mockResolvedValue([])
})

it('requires staff authority before reading the body', async () => {
  requireCapability.mockRejectedValueOnce(new AurevaneError('FORBIDDEN', 'No'))
  const response = await POST(request('invalid'))
  expect(response.status).toBe(403)
  expect(setEnvironment).not.toHaveBeenCalled()
})
it('rejects staff without the assigned World Environment page', async () => {
  requireCapability.mockRejectedValue(new AurevaneError('FORBIDDEN', 'Page access required.'))
  expect((await POST(request({ expectedVersion: 0, change, reason: 'Owner test' }))).status).toBe(
    403,
  )
  expect((await GET(new Request('http://localhost/api/master/world-environment'))).status).toBe(403)
  expect(setEnvironment).not.toHaveBeenCalled()
  expect(readHistory).not.toHaveBeenCalled()
})
it('passes the authenticated actor and returns private settings without an audit-history workflow', async () => {
  const settings = { version: 1, timeOffsetMinutes: 60 }
  setEnvironment.mockResolvedValueOnce(settings)
  readHistory.mockResolvedValueOnce([{ id: 1 }])
  const response = await POST(request({ expectedVersion: 0, change, reason: 'Owner test' }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ settings })
  expect(readHistory).not.toHaveBeenCalled()
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(setEnvironment).toHaveBeenCalledWith({
    actorUserId: 'owner',
    expectedVersion: 0,
    change,
  })
})
it('rejects malformed JSON and maps stale versions to a conflict', async () => {
  expect((await POST(request('{not json'))).status).toBe(400)
  setEnvironment.mockRejectedValueOnce(new AurevaneError('STALE_VERSION', 'Refresh'))
  const stale = await POST(request({ expectedVersion: 0, change, reason: 'Owner test' }))
  expect(stale.status).toBe(409)
})

it('returns a private, public-terrain-only region preview with no player session or mission data', async () => {
  const response = await GET(
    new Request('http://localhost/api/master/world-environment?previewRegion=frostmere'),
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  const { view } = await response.json()
  expect(view.position.sectorId).toBe('frostmere')
  expect(view.sectors[0]).toMatchObject({ id: 'frostmere', charted: true })
  expect(view.sectors[0].cells.some((cell: { walkable: boolean }) => !cell.walkable)).toBe(true)
  expect(view.sectors.every((sector: { charted: boolean }) => sector.charted)).toBe(true)
  expect(view).toMatchObject({
    characterId: '',
    route: [],
    players: [],
    objectives: [],
    interactions: [],
    battleSessionId: null,
  })
  expect(readHistory).not.toHaveBeenCalled()
  expect(setEnvironment).not.toHaveBeenCalled()
})

it('rejects forged preview region IDs and applies the same page access before projecting terrain', async () => {
  const preview = (region: string) =>
    new Request(`http://localhost/api/master/world-environment?previewRegion=${region}`)
  expect((await GET(preview('hidden-frontier'))).status).toBe(400)
  requireCapability.mockRejectedValueOnce(new AurevaneError('FORBIDDEN', 'Page access required.'))
  expect((await GET(preview('frostmere'))).status).toBe(403)
})
