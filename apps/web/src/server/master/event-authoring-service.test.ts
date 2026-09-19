import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { PersistentEventDefinition } from '@aurevane/game-core/events/persistent-event'

import {
  createEventAuthoringService,
  type EventAuthoringStore,
  type EventDefinitionDraftRecord,
  type EventDefinitionVersionRecord,
  type EventRunTransitionRecord,
  type ScheduledEventRunRecord,
} from './event-authoring-service'
import {
  createMasterPanelStaffAccessService,
  type MasterPanelAccessRecord,
  type MasterPanelStaffAccessStore,
} from './staff-access'

const EVENT_STAFF = '11111111-1111-4111-8111-111111111111'
const OWNER = '22222222-2222-4222-8222-222222222222'

const definition = (
  scope: PersistentEventDefinition['scope'] = { type: 'region', key: 'region.frostmere' },
): PersistentEventDefinition => ({
  schemaVersion: 1,
  eventKey: 'event.frostmere-storm',
  templateKey: 'template.regional-crisis',
  contentVersion: 1,
  title: 'Storm over Frostmere',
  summary: 'A regional storm disrupts travel.',
  internalNotes: 'P4.13 fixture.',
  family: 'regional-event',
  scope,
  phases: [
    {
      id: 'mobilization',
      name: 'Mobilization',
      objectives: [
        {
          id: 'community',
          type: 'community-threshold',
          referenceKey: 'objective.frostmere',
          target: 10,
        },
      ],
      effects: [
        {
          type: 'world-pulse',
          referenceKey: 'announcement.frostmere',
          enabled: true,
        },
      ],
      cleanupEffects: [],
      transition: { type: 'objective-threshold', objectiveId: 'community' },
    },
  ],
  rewardPackageRefs: [],
  aftermathRefs: [],
})

class StaffStore implements MasterPanelStaffAccessStore {
  readonly records = new Map<string, MasterPanelAccessRecord>()

  async readAccess(userId: string) {
    return this.records.get(userId) ?? null
  }

  async listStaff() {
    return []
  }

  async resolveAccountByEmail() {
    return null
  }

  async grantRole() {
    return 1
  }

  async revokeRole() {
    return 1
  }

  async grantCapability() {
    return 1
  }

  async revokeCapability() {
    return 1
  }
}

class MemoryEventStore implements EventAuthoringStore {
  draft: EventDefinitionDraftRecord | null = null
  current: EventDefinitionVersionRecord | null = null
  versions: EventDefinitionVersionRecord[] = []
  scheduled: ScheduledEventRunRecord = {
    runId: '33333333-3333-4333-8333-333333333333',
    stateVersion: 1,
    replayed: false,
  }
  cancelled: EventRunTransitionRecord = {
    runId: this.scheduled.runId,
    lifecycleStatus: 'cancelled',
    stateVersion: 2,
    replayed: false,
  }

  async readDraft() {
    return this.draft
  }

  async saveDraft(input: {
    eventKey: string
    definition: PersistentEventDefinition
    baseVersion: number | null
    expectedDraftVersion: number | null
  }) {
    this.draft = {
      eventKey: input.eventKey,
      definition: input.definition,
      baseVersion: input.baseVersion,
      draftVersion: (input.expectedDraftVersion ?? 0) + 1,
      updatedBy: EVENT_STAFF,
      updatedAt: '2026-09-19T12:00:00.000Z',
    }
    return this.draft
  }

  async readCurrent() {
    return this.current
  }

  async listVersions() {
    return this.versions
  }

  async publish(input: {
    eventKey: string
    definition: PersistentEventDefinition
    expectedBaseVersion: number | null
    correlationKey: string
    reason: string
    confirmed: boolean
  }) {
    const version = (input.expectedBaseVersion ?? 0) + 1
    this.current = {
      id: '44444444-4444-4444-8444-444444444444',
      eventKey: input.eventKey,
      definitionVersion: version,
      definition: { ...input.definition, contentVersion: version },
      publishedBy: EVENT_STAFF,
      publishedAt: '2026-09-19T12:00:00.000Z',
      current: true,
    }
    this.versions = [this.current]
    return this.current
  }

  async schedule() {
    return this.scheduled
  }

  async cancelScheduled() {
    return this.cancelled
  }
}

function access(
  userId: string,
  roles: MasterPanelAccessRecord['roles'],
  specialCapabilities: MasterPanelAccessRecord['specialCapabilities'] = [],
): MasterPanelAccessRecord {
  return { userId, accessVersion: 1, roles, specialCapabilities }
}

function serviceFor(record: MasterPanelAccessRecord) {
  const staff = new StaffStore()
  staff.records.set(record.userId, record)
  const store = new MemoryEventStore()
  return {
    service: createEventAuthoringService({
      store,
      staffAccess: createMasterPanelStaffAccessService(staff),
    }),
    store,
  }
}

describe('Event Builder authoring service', () => {
  it('allows Event Staff to validate, preview and save private typed drafts', async () => {
    const { service } = serviceFor(access(EVENT_STAFF, ['event-staff']))

    expect(service.validateDefinition(definition())).toEqual({ valid: true, issues: [] })

    const preview = await service.previewDefinition({
      actorUserId: EVENT_STAFF,
      definition: definition(),
      phaseId: 'mobilization',
      testClock: '2026-09-19T14:00:00.000Z',
    })

    expect(preview).toMatchObject({
      eventKey: 'event.frostmere-storm',
      testClock: '2026-09-19T14:00:00.000Z',
      selectedPhase: {
        id: 'mobilization',
        objectiveCount: 1,
        effectCount: 1,
      },
    })

    await expect(
      service.saveDraft({
        actorUserId: EVENT_STAFF,
        definition: definition(),
        baseVersion: null,
        expectedDraftVersion: null,
      }),
    ).resolves.toMatchObject({ draftVersion: 1, baseVersion: null })
  })

  it('rejects arbitrary execution fields before persistence', () => {
    const { service } = serviceFor(access(EVENT_STAFF, ['event-staff']))
    const invalid = {
      ...definition(),
      phases: [{ ...definition().phases[0], script: 'drop table anything' }],
    }

    expect(service.validateDefinition(invalid)).toMatchObject({
      valid: false,
      issues: [expect.objectContaining({ code: 'ARBITRARY_EXECUTION_FIELD' })],
    })
  })

  it('requires the explicit Production publication capability for Event Staff', async () => {
    const { service } = serviceFor(access(EVENT_STAFF, ['event-staff']))

    await expect(
      service.publish({
        actorUserId: EVENT_STAFF,
        definition: definition(),
        expectedBaseVersion: null,
        correlationKey: '88888888-8888-4888-8888-888888888888',
        reason: 'Publish verified Event definition',
        confirmed: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('requires explicit confirmation and reason even when publication capability is present', async () => {
    const { service } = serviceFor(
      access(EVENT_STAFF, ['event-staff'], ['events.production_publish']),
    )

    await expect(
      service.publish({
        actorUserId: EVENT_STAFF,
        definition: definition(),
        expectedBaseVersion: null,
        correlationKey: '88888888-8888-4888-8888-888888888881',
        reason: 'Publish verified Event definition',
        confirmed: false,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })

    await expect(
      service.publish({
        actorUserId: EVENT_STAFF,
        definition: definition(),
        expectedBaseVersion: null,
        correlationKey: '88888888-8888-4888-8888-888888888882',
        reason: '',
        confirmed: true,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('allows scoped publication with Production publish but separately gates global scope', async () => {
    const scoped = serviceFor(access(EVENT_STAFF, ['event-staff'], ['events.production_publish']))

    await expect(
      scoped.service.publish({
        actorUserId: EVENT_STAFF,
        definition: definition(),
        expectedBaseVersion: null,
        correlationKey: '88888888-8888-4888-8888-888888888888',
        reason: 'Publish verified Event definition',
        confirmed: true,
      }),
    ).resolves.toMatchObject({ definitionVersion: 1 })

    await expect(
      scoped.service.publish({
        actorUserId: EVENT_STAFF,
        definition: definition({ type: 'global' }),
        expectedBaseVersion: 1,
        correlationKey: '99999999-9999-4999-8999-999999999999',
        reason: 'Publish verified global Event definition',
        confirmed: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const global = serviceFor(
      access(EVENT_STAFF, ['event-staff'], ['events.production_publish', 'events.global_scope']),
    )
    await expect(
      global.service.publish({
        actorUserId: EVENT_STAFF,
        definition: definition({ type: 'global' }),
        expectedBaseVersion: null,
        correlationKey: '88888888-8888-4888-8888-888888888888',
        reason: 'Publish verified Event definition',
        confirmed: true,
      }),
    ).resolves.toMatchObject({ definitionVersion: 1 })
  })

  it('lets the Game Owner inherit author, Production and global Event authority', async () => {
    const { service } = serviceFor(access(OWNER, ['game-owner']))

    await expect(
      service.publish({
        actorUserId: OWNER,
        definition: definition({ type: 'global' }),
        expectedBaseVersion: null,
        correlationKey: '88888888-8888-4888-8888-888888888888',
        reason: 'Publish verified Event definition',
        confirmed: true,
      }),
    ).resolves.toMatchObject({ definitionVersion: 1 })
  })

  it('requires a published definition before schedule and preserves normal Event Staff operations', async () => {
    const { service, store } = serviceFor(access(EVENT_STAFF, ['event-staff']))

    await expect(
      service.schedule({
        actorUserId: EVENT_STAFF,
        eventKey: 'event.frostmere-storm',
        idempotencyKey: '55555555-5555-4555-8555-555555555555',
        requestFingerprint: 'schedule:frostmere',
        scheduledStartAt: '2026-09-20T12:00:00.000Z',
        scheduledEndAt: '2026-09-20T14:00:00.000Z',
        reason: 'Schedule verified Event run',
        confirmed: true,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })

    store.current = {
      id: '66666666-6666-4666-8666-666666666666',
      eventKey: 'event.frostmere-storm',
      definitionVersion: 1,
      definition: definition(),
      publishedBy: OWNER,
      publishedAt: '2026-09-19T12:00:00.000Z',
      current: true,
    }

    await expect(
      service.schedule({
        actorUserId: EVENT_STAFF,
        eventKey: 'event.frostmere-storm',
        idempotencyKey: '55555555-5555-4555-8555-555555555555',
        requestFingerprint: 'schedule:frostmere',
        scheduledStartAt: '2026-09-20T12:00:00.000Z',
        scheduledEndAt: '2026-09-20T14:00:00.000Z',
        reason: 'Schedule verified Event run',
        confirmed: true,
      }),
    ).resolves.toEqual(store.scheduled)

    await expect(
      service.cancelScheduled({
        actorUserId: EVENT_STAFF,
        runId: store.scheduled.runId,
        expectedStateVersion: 1,
        idempotencyKey: '77777777-7777-4777-8777-777777777777',
        reason: 'Schedule changed',
        confirmed: true,
      }),
    ).resolves.toEqual(store.cancelled)
  })
})
