import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('./event-authoring-server', () => ({ createServerEventAuthoringService: vi.fn() }))
vi.mock('./event-operations-server', () => ({ createServerEventOperationsService: vi.fn() }))
import { handleEventAuthoringRequest } from './event-authoring-handler'
import { handleEventOperationsRequest } from './event-operations-handler'
import { createEventAuthoringService, type EventAuthoringStore } from './event-authoring-service'
import { createEventOperationsService, type EventOperationsStore } from './event-operations-service'
import type { MasterPanelStaffAccessService } from './staff-access'
const actor = '11111111-1111-4111-8111-111111111111'
const run = '22222222-2222-4222-8222-222222222222'
const staffAccess = {
  requireCapability: vi.fn(async () => ({
    userId: actor,
    accessVersion: 1,
    roles: ['game-owner'],
    effectiveCapabilities: ['events.author', 'events.operate', 'events.global_scope'],
  })),
} as unknown as MasterPanelStaffAccessService
const request = (body: object) =>
  new Request('https://local.test/api/master/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
it('authoring handler derives attribution and scheduling fingerprint, without requiring or accepting a reason as intent', async () => {
  const schedule = vi.fn<EventAuthoringStore['schedule']>(async () => ({
    runId: run,
    stateVersion: 1,
    replayed: false,
  }))
  const store = {
    schedule,
    readCurrent: vi.fn(async () => ({
      definition: { scope: { type: 'region', key: 'verdant-expanse' } },
    })),
  } as unknown as EventAuthoringStore
  const service = createEventAuthoringService({ store, staffAccess })
  const response = await handleEventAuthoringRequest(
    request({
      operation: 'schedule',
      actorUserId: 'forged',
      eventKey: 'event.watch',
      idempotencyKey: run,
      scheduledStartAt: '2026-12-01T12:00:00Z',
      scheduledEndAt: null,
      confirmed: true,
    }),
    { getActor: async () => ({ userId: actor }), createService: () => service },
  )
  expect(response.status).toBe(200)
  expect(schedule).toHaveBeenCalledWith(
    expect.objectContaining({ requestFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/) }),
  )
  expect(schedule.mock.calls[0]![0]).not.toHaveProperty('reason')
  expect(staffAccess.requireCapability).toHaveBeenCalledWith(actor, 'events.operate')
})
it('live handler retains consequential confirmation and exact CAS, with server actor attribution', async () => {
  const operate = vi.fn(async () => ({
    runId: run,
    lifecycleStatus: 'emergency-stopped',
    stateVersion: 8,
    replayed: false,
  }))
  const service = createEventOperationsService({
    store: { operate } as unknown as EventOperationsStore,
    staffAccess,
  })
  const dependencies = { getActor: async () => ({ userId: actor }), createService: () => service }
  const body = {
    operation: 'operate',
    actorUserId: 'forged',
    runId: run,
    expectedStateVersion: 7,
    idempotencyKey: run,
    command: 'emergency-stop',
    confirmed: false,
  }
  expect((await handleEventOperationsRequest(request(body), dependencies)).status).toBe(400)
  expect(operate).not.toHaveBeenCalled()
  expect(
    (await handleEventOperationsRequest(request({ ...body, confirmed: true }), dependencies))
      .status,
  ).toBe(200)
  expect(operate).toHaveBeenCalledWith({
    actorUserId: actor,
    runId: run,
    expectedStateVersion: 7,
    idempotencyKey: run,
    command: 'emergency-stop',
    confirmed: true,
  })
})
