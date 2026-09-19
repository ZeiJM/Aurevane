import { describe, expect, it, vi } from 'vitest'

import { AurevaneError } from '@aurevane/game-core/errors'

import {
  createEventOperationsService,
  type EventOperationDashboard,
  type EventOperationsStore,
} from './event-operations-service'
import type {
  MasterPanelAccess,
  MasterPanelCapability,
  MasterPanelStaffAccessService,
} from './staff-access'

const runId = '00000000-0000-4000-8000-000000004401'
const idempotencyKey = '00000000-0000-4000-8000-000000004402'

function access(capabilities: readonly MasterPanelCapability[]): MasterPanelAccess {
  return {
    userId: '00000000-0000-4000-8000-000000004403',
    accessVersion: 1,
    roles: ['event-staff'],
    specialCapabilities: capabilities.filter(
      (capability) => capability.startsWith('events.') && capability.includes('.'),
    ) as MasterPanelAccess['specialCapabilities'],
    effectiveCapabilities: capabilities,
  }
}

function staffAccess(
  capabilities: readonly MasterPanelCapability[],
): MasterPanelStaffAccessService {
  const current = access(capabilities)
  return {
    readAccess: vi.fn(async () => current),
    requireCapability: vi.fn(async (_userId, capability) => {
      if (!current.effectiveCapabilities.includes(capability)) {
        throw new AurevaneError('FORBIDDEN', 'Missing capability.')
      }
      return current
    }),
    listStaff: vi.fn(),
    resolveAccountByEmail: vi.fn(),
    grantRole: vi.fn(),
    revokeRole: vi.fn(),
    grantCapability: vi.fn(),
    revokeCapability: vi.fn(),
  }
}

function dashboard(): EventOperationDashboard {
  return {
    run: {
      runId,
      eventKey: 'event.test',
      definitionVersionId: '00000000-0000-4000-8000-000000004404',
      lifecycleStatus: 'live',
      stateVersion: 3,
      scopeType: 'region',
      scopeKey: 'region.frostmere',
      currentPhaseId: 'mobilization',
      scheduledStartAt: null,
      scheduledEndAt: null,
      startedAt: '2026-09-19T05:00:00.000Z',
      pausedAt: null,
      resolvingAt: null,
      endedAt: null,
      archivedAt: null,
      cancelledAt: null,
      emergencyStoppedAt: null,
      cleanupStatus: 'not-required',
      cleanupRequiredAt: null,
      cleanupCompletedAt: null,
      updatedAt: '2026-09-19T05:00:00.000Z',
    },
    activeEffects: [],
    phases: [],
    participants: [],
    claims: [],
    cleanupRequirements: [],
    chronicle: null,
  }
}

function store(): EventOperationsStore {
  return {
    listRuns: vi.fn(async () => []),
    readDashboard: vi.fn(async () => dashboard()),
    operate: vi.fn(async (input) => ({
      runId: input.runId,
      lifecycleStatus: input.command === 'pause' ? 'paused' : 'emergency-stopped',
      stateVersion: input.expectedStateVersion + 1,
      replayed: false,
    })),
    advancePhase: vi.fn(async (input) => ({
      runId: input.runId,
      currentPhaseId: 'aftermath',
      stateVersion: input.expectedStateVersion + 1,
      replayed: false,
    })),
    completeCleanup: vi.fn(async (input) => ({
      runId: input.runId,
      cleanupStatus: 'completed',
      stateVersion: 8,
      replayed: false,
    })),
  }
}

describe('live Event operations service', () => {
  it('requires Event operations capability before reading state', async () => {
    const service = createEventOperationsService({
      store: store(),
      staffAccess: staffAccess(['master.access']),
    })

    await expect(service.listRuns('staff')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('allows normal Event Staff lifecycle operations through events.operate', async () => {
    const persistence = store()
    const service = createEventOperationsService({
      store: persistence,
      staffAccess: staffAccess(['master.access', 'events.operate']),
    })

    const result = await service.operate({
      actorUserId: 'staff',
      runId,
      expectedStateVersion: 3,
      idempotencyKey,
      command: 'pause',
      reason: 'Pause for verification',
      confirmed: true,
    })

    expect(result.lifecycleStatus).toBe('paused')
    expect(persistence.operate).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'staff',
        runId,
        expectedStateVersion: 3,
        command: 'pause',
      }),
    )
  })

  it('requires explicit confirmation for a normal live Event mutation', async () => {
    const service = createEventOperationsService({
      store: store(),
      staffAccess: staffAccess(['master.access', 'events.operate']),
    })

    await expect(
      service.operate({
        actorUserId: 'staff',
        runId,
        expectedStateVersion: 3,
        idempotencyKey,
        command: 'pause',
        reason: 'Pause for verification',
        confirmed: false,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('requires explicit emergency-stop capability for emergency shutdown', async () => {
    const service = createEventOperationsService({
      store: store(),
      staffAccess: staffAccess(['master.access', 'events.operate']),
    })

    await expect(
      service.operate({
        actorUserId: 'staff',
        runId,
        expectedStateVersion: 3,
        idempotencyKey,
        command: 'emergency-stop',
        reason: 'Emergency shutdown',
        confirmed: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('passes emergency stop after the special capability is present', async () => {
    const persistence = store()
    const service = createEventOperationsService({
      store: persistence,
      staffAccess: staffAccess(['master.access', 'events.operate', 'events.emergency_stop']),
    })

    const result = await service.operate({
      actorUserId: 'staff',
      runId,
      expectedStateVersion: 3,
      idempotencyKey,
      command: 'emergency-stop',
      reason: 'Emergency shutdown',
      confirmed: true,
    })

    expect(result.lifecycleStatus).toBe('emergency-stopped')
  })

  it('validates optimistic versions and cleanup ordinals before persistence', async () => {
    const service = createEventOperationsService({
      store: store(),
      staffAccess: staffAccess(['master.access', 'events.operate']),
    })

    await expect(
      service.advancePhase({
        actorUserId: 'staff',
        runId,
        expectedStateVersion: 0,
        idempotencyKey,
        reason: 'Advance phase',
        confirmed: true,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })

    await expect(
      service.completeCleanup({
        actorUserId: 'staff',
        runId,
        phaseId: 'mobilization',
        effectOrdinal: -1,
        completionKey: idempotencyKey,
        reason: 'Cleanup complete',
        confirmed: true,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })
})
