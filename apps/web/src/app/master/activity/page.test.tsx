import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'

const dependencies = vi.hoisted(() => ({
  getActor: vi.fn(),
  readAccess: vi.fn(),
  requireCapability: vi.fn(),
  read: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: dependencies.getActor }))
vi.mock('@/server/master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => ({
    requireCapability: dependencies.requireCapability,
  }),
}))
vi.mock('@/server/master/activity-log-server', () => ({
  createServerMasterActivityService: () => ({ read: dependencies.read }),
}))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))
vi.mock('@/components/master/master-panel-shell', () => ({
  MasterPanelShell: ({ children }: { children: import('react').ReactNode }) =>
    createElement('div', {}, children),
}))
import { createMasterPanelStaffAccessService } from '@/server/master/staff-access'
import MasterActivityPage from './page'

const ownerAccess = {
  userId: 'owner',
  accessVersion: 1,
  roles: ['game-owner'] as const,
  specialCapabilities: [],
  effectiveCapabilities: ['activity.read', 'staff.manage'] as const,
}
const staffAccess = {
  userId: 'staff',
  accessVersion: 1,
  roles: ['moderator'] as const,
  specialCapabilities: [],
  effectiveCapabilities: ['activity.read'] as const,
}
beforeEach(() => {
  vi.resetAllMocks()
  const service = createMasterPanelStaffAccessService({
    readAccess: dependencies.readAccess,
    listStaff: async () => [],
    resolveIdentity: async () => null,
    setCharacterAccess: async () => 1,
  })
  dependencies.requireCapability.mockImplementation(service.requireCapability)
  dependencies.getActor.mockResolvedValue({ userId: 'owner' })
  dependencies.readAccess.mockResolvedValue(ownerAccess)
  dependencies.read.mockResolvedValue({
    entries: [],
    weekStartsAt: '2026-10-26T00:00:00Z',
    resetsAt: '2026-11-02T00:00:00Z',
    nextCursor: null,
  })
})

it('loads the Owner Activity page through the live activity.read authority', async () => {
  expect(renderToStaticMarkup(await MasterActivityPage())).toContain(
    'No changes recorded this week.',
  )
  expect(dependencies.requireCapability).toHaveBeenCalledWith('owner', 'activity.read')
  expect(dependencies.readAccess).toHaveBeenCalledWith('owner')
  expect(dependencies.read).toHaveBeenCalledWith('owner')
})

it('allows delegated Activity access and denies a live page revocation before reading the feed', async () => {
  dependencies.getActor.mockResolvedValue({ userId: 'staff' })
  dependencies.readAccess.mockResolvedValue(staffAccess)
  expect(renderToStaticMarkup(await MasterActivityPage())).toContain(
    'No changes recorded this week.',
  )
  expect(dependencies.requireCapability).toHaveBeenCalledWith('staff', 'activity.read')
  expect(dependencies.read).toHaveBeenCalledWith('staff')
  dependencies.read.mockClear()
  dependencies.readAccess.mockResolvedValue({ ...staffAccess, effectiveCapabilities: [] })
  await expect(MasterActivityPage()).rejects.toThrow('redirect:/master')
  expect(dependencies.getActor).toHaveBeenCalledTimes(2)
  expect(dependencies.readAccess).toHaveBeenCalledTimes(2)
  expect(dependencies.read).not.toHaveBeenCalled()
})

it('keeps staff management protected for the Game Owner even when Activity is delegated', async () => {
  await expect(dependencies.requireCapability('owner', 'staff.manage')).resolves.toEqual(
    ownerAccess,
  )
  dependencies.readAccess.mockResolvedValue({
    ...staffAccess,
    effectiveCapabilities: ['activity.read', 'staff.manage'],
  })
  await expect(dependencies.requireCapability('staff', 'staff.manage')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
})

it('requires a fresh authenticated actor before consulting access or reading the feed', async () => {
  dependencies.getActor.mockRejectedValue(new AurevaneError('UNAUTHENTICATED', 'Sign in.'))
  await expect(MasterActivityPage()).rejects.toThrow('redirect:/')
  expect(dependencies.readAccess).not.toHaveBeenCalled()
  expect(dependencies.read).not.toHaveBeenCalled()
})
