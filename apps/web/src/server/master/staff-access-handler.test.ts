import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { AurevaneError } from '@aurevane/game-core/errors'

import {
  handleStaffAccessRequest,
  type StaffAccessHandlerDependencies,
} from './staff-access-handler'
import type { MasterPanelStaffAccessService } from './staff-access'

const OWNER = '11111111-1111-4111-8111-111111111111'
const STAFF = '22222222-2222-4222-8222-222222222222'

function serviceMock(): MasterPanelStaffAccessService {
  return {
    readAccess: vi.fn(async () => null),
    requireCapability: vi.fn(async () => {
      throw new Error('Not used directly by handler tests.')
    }),
    listStaff: vi.fn(async () => []),
    resolveAccountByEmail: vi.fn(async () => ({ userId: STAFF, email: 'staff@example.com' })),
    grantRole: vi.fn(async () => 2),
    revokeRole: vi.fn(async () => 3),
    grantCapability: vi.fn(async () => 4),
    revokeCapability: vi.fn(async () => 5),
  }
}

function dependencies(service = serviceMock()): StaffAccessHandlerDependencies {
  return {
    getActor: async () => ({ userId: OWNER }),
    createService: vi.fn(() => service),
  }
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/master/staff-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('staff access handler', () => {
  it('resolves an exact account through the authenticated Owner context', async () => {
    const service = serviceMock()
    const response = await handleStaffAccessRequest(
      post({ operation: 'resolve-account', email: 'staff@example.com' }),
      dependencies(service),
    )

    expect(response.status).toBe(200)
    expect(service.resolveAccountByEmail).toHaveBeenCalledWith(OWNER, 'staff@example.com')
    await expect(response.json()).resolves.toEqual({
      account: { userId: STAFF, email: 'staff@example.com' },
    })
  })

  it('injects the authenticated Owner identity into confirmed role grants', async () => {
    const service = serviceMock()
    const response = await handleStaffAccessRequest(
      post({
        operation: 'grant-role',
        targetUserId: STAFF,
        role: 'content-staff',
        reason: 'Combat content',
        confirmed: true,
        actorUserId: STAFF,
      }),
      dependencies(service),
    )

    expect(response.status).toBe(200)
    expect(service.grantRole).toHaveBeenCalledWith({
      actorUserId: OWNER,
      targetUserId: STAFF,
      role: 'content-staff',
      reason: 'Combat content',
    })
    await expect(response.json()).resolves.toEqual({ accessVersion: 2 })
  })

  it('routes confirmed special-capability revocation through the protected service', async () => {
    const service = serviceMock()
    const response = await handleStaffAccessRequest(
      post({
        operation: 'revoke-capability',
        targetUserId: STAFF,
        capability: 'events.global_scope',
        reason: 'Scope removed',
        confirmed: true,
      }),
      dependencies(service),
    )

    expect(response.status).toBe(200)
    expect(service.revokeCapability).toHaveBeenCalledWith({
      actorUserId: OWNER,
      targetUserId: STAFF,
      capability: 'events.global_scope',
      reason: 'Scope removed',
    })
  })

  it('requires both a reason and explicit confirmation for authority mutation', async () => {
    const service = serviceMock()

    const noConfirmation = await handleStaffAccessRequest(
      post({
        operation: 'grant-role',
        targetUserId: STAFF,
        role: 'event-staff',
        reason: 'Live events',
      }),
      dependencies(service),
    )
    const noReason = await handleStaffAccessRequest(
      post({
        operation: 'grant-role',
        targetUserId: STAFF,
        role: 'event-staff',
        confirmed: true,
      }),
      dependencies(service),
    )

    expect(noConfirmation.status).toBe(400)
    expect(noReason.status).toBe(400)
    expect(service.grantRole).not.toHaveBeenCalled()
  })

  it('rejects protected role/capability identities before mutation', async () => {
    const service = serviceMock()
    const ownerRole = await handleStaffAccessRequest(
      post({
        operation: 'grant-role',
        targetUserId: STAFF,
        role: 'game-owner',
        reason: 'Should fail',
        confirmed: true,
      }),
      dependencies(service),
    )
    const rootCapability = await handleStaffAccessRequest(
      post({
        operation: 'grant-capability',
        targetUserId: STAFF,
        capability: 'staff.manage',
        reason: 'Should fail',
        confirmed: true,
      }),
      dependencies(service),
    )

    expect(ownerRole.status).toBe(400)
    expect(rootCapability.status).toBe(400)
    expect(service.grantRole).not.toHaveBeenCalled()
    expect(service.grantCapability).not.toHaveBeenCalled()
  })

  it('preserves authorization failures from the staff service', async () => {
    const service = serviceMock()
    vi.mocked(service.grantRole).mockRejectedValue(
      new AurevaneError('FORBIDDEN', 'Master Panel unavailable.'),
    )

    const response = await handleStaffAccessRequest(
      post({
        operation: 'grant-role',
        targetUserId: STAFF,
        role: 'moderator',
        reason: 'Moderation duty',
        confirmed: true,
      }),
      dependencies(service),
    )

    expect(response.status).toBe(403)
  })
})
