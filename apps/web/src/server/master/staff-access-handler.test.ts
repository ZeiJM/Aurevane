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
    grantRole: vi.fn(async () => 2),
    revokeRole: vi.fn(async () => 3),
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
  it('injects the authenticated Owner identity into grants', async () => {
    const service = serviceMock()
    const response = await handleStaffAccessRequest(
      post({
        operation: 'grant-role',
        targetUserId: STAFF,
        role: 'content-staff',
        note: 'Combat content',
        actorUserId: STAFF,
      }),
      dependencies(service),
    )

    expect(response.status).toBe(200)
    expect(service.grantRole).toHaveBeenCalledWith({
      actorUserId: OWNER,
      targetUserId: STAFF,
      role: 'content-staff',
      note: 'Combat content',
    })
    await expect(response.json()).resolves.toEqual({ accessVersion: 2 })
  })

  it('routes revocation through the protected service', async () => {
    const service = serviceMock()
    const response = await handleStaffAccessRequest(
      post({
        operation: 'revoke-role',
        targetUserId: STAFF,
        role: 'event-staff',
      }),
      dependencies(service),
    )

    expect(response.status).toBe(200)
    expect(service.revokeRole).toHaveBeenCalledWith({
      actorUserId: OWNER,
      targetUserId: STAFF,
      role: 'event-staff',
      note: null,
    })
  })

  it('rejects attempts to mutate the protected Game Owner role', async () => {
    const service = serviceMock()
    const response = await handleStaffAccessRequest(
      post({
        operation: 'grant-role',
        targetUserId: STAFF,
        role: 'game-owner',
      }),
      dependencies(service),
    )

    expect(response.status).toBe(400)
    expect(service.grantRole).not.toHaveBeenCalled()
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
      }),
      dependencies(service),
    )

    expect(response.status).toBe(403)
  })
})
