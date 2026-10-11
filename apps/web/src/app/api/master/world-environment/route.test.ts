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
  readWorldEnvironmentHistory: readHistory,
}))
import { GET, POST } from './route'

const change = { timeOffsetMinutes: 60, frozenMinuteOfDay: null, weather: 'rain', duration: '1h' }
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
it('rejects delegated staff who are not the Game Owner', async () => {
  requireCapability.mockResolvedValue({ roles: ['content-staff'] })
  expect((await POST(request({ expectedVersion: 0, change, reason: 'Owner test' }))).status).toBe(
    403,
  )
  expect((await GET()).status).toBe(403)
  expect(setEnvironment).not.toHaveBeenCalled()
  expect(readHistory).not.toHaveBeenCalled()
})
it('passes the authenticated actor and returns private settings with history', async () => {
  const settings = { version: 1, timeOffsetMinutes: 60 }
  setEnvironment.mockResolvedValueOnce(settings)
  readHistory.mockResolvedValueOnce([{ id: 1 }])
  const response = await POST(request({ expectedVersion: 0, change, reason: 'Owner test' }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ settings, history: [{ id: 1 }] })
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(setEnvironment).toHaveBeenCalledWith({
    actorUserId: 'owner',
    expectedVersion: 0,
    change,
    reason: 'Owner test',
  })
})
it('rejects malformed JSON and maps stale versions to a conflict', async () => {
  expect((await POST(request('{not json'))).status).toBe(400)
  setEnvironment.mockRejectedValueOnce(new AurevaneError('STALE_VERSION', 'Refresh'))
  const stale = await POST(request({ expectedVersion: 0, change, reason: 'Owner test' }))
  expect(stale.status).toBe(409)
})
