import type { BattleEventRepository } from '@aurevane/db/battle-session'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type {
  BattleHistoryPrivacyAuthority,
  BattleHistoryPrivacyRepository,
} from './battle-history-privacy-authority'
import { createViewerSafeBattleLogService } from './battle-log-service'
import { deriveParticipantBattleViewerEntitlement } from './battle-viewer-entitlement'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const ACTOR = 'character:actor'
const TARGET = 'character:target'

const records = [
  {
    battleVersion: 9,
    eventIndex: 0,
    event: { event: 'combat_action_used', actorId: ACTOR, actionId: 'secret.sensory' },
    createdAt: '2026-09-17T12:00:00.000Z',
  },
  {
    battleVersion: 9,
    eventIndex: 1,
    event: {
      event: 'damage_applied',
      actionId: 'secret.sensory',
      sourceCombatantId: ACTOR,
      targetCombatantId: TARGET,
      amount: 1,
      hpAfter: 99,
    },
    createdAt: '2026-09-17T12:00:00.000Z',
  },
  {
    battleVersion: 9,
    eventIndex: 2,
    event: {
      event: 'status_removed',
      actionId: 'secret.sensory',
      sourceCombatantId: ACTOR,
      targetCombatantId: TARGET,
      statusId: 'covert',
    },
    createdAt: '2026-09-17T12:00:00.000Z',
  },
  {
    battleVersion: 9,
    eventIndex: 3,
    event: {
      event: 'status_applied',
      actionId: 'secret.sensory',
      sourceCombatantId: ACTOR,
      targetCombatantId: TARGET,
      statusId: 'revealed',
      stacks: 1,
      remainingOwnerTurnStarts: 4,
      refreshed: false,
      stacked: false,
    },
    createdAt: '2026-09-17T12:00:00.000Z',
  },
  {
    battleVersion: 9,
    eventIndex: 4,
    event: {
      event: 'combat_accuracy_resolved',
      actionId: 'secret.sensory',
      sourceCombatantId: ACTOR,
      targetCombatantId: TARGET,
      hit: false,
      rollBasisPoints: 9000,
      hitChanceBasisPoints: 7400,
      accuracyRulesVersion: 1,
    },
    createdAt: '2026-09-17T12:00:00.000Z',
  },
] as const

describe('CSR-3 battle log privacy integration', () => {
  it.each(['bleed', 'poison', 'burn'] as const)(
    'does not let an earlier public %s cast authorize a later hidden reapplication',
    async (statusId) => {
      const sourceId = 'secret.reapplied-skill'
      const application = (battleVersion: number) =>
        [
          { event: 'combat_action_used', actorId: ACTOR, actionId: sourceId },
          {
            event: 'persistent_effect_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: TARGET,
            actionId: sourceId,
            statusId,
          },
        ].map((event, eventIndex) => ({
          battleVersion,
          eventIndex,
          createdAt: '2026-10-04T00:00:00Z',
          event,
        }))
      const sourceRecords = [
        ...application(1),
        {
          battleVersion: 1,
          eventIndex: 2,
          createdAt: '2026-10-04T00:00:00Z',
          event: {
            event: 'damage_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: TARGET,
            actionId: statusId === 'bleed' ? sourceId : `status.${statusId}.current.v1`,
            sourceActionId: sourceId,
            statusId,
            amount: 4,
          },
        },
        ...application(2),
        {
          battleVersion: 3,
          eventIndex: 0,
          createdAt: '2026-10-04T00:00:01Z',
          event: {
            event: 'damage_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: TARGET,
            actionId: statusId === 'bleed' ? sourceId : `status.${statusId}.current.v1`,
            sourceActionId: sourceId,
            statusId,
            amount: 4,
          },
        },
      ]
      const authority: BattleHistoryPrivacyAuthority = {
        viewer: deriveParticipantBattleViewerEntitlement(
          [
            { id: ACTOR, teamId: 'team:a' },
            { id: TARGET, teamId: 'team:b' },
          ],
          [TARGET],
        ),
        journals: [1, 2, 3].map((battleVersion) => ({
          schemaVersion: 1,
          battleVersion,
          actorCombatantId: ACTOR,
          actorTeamId: 'team:a',
          eventCount: battleVersion === 1 ? 3 : battleVersion === 3 ? 1 : 2,
          commandVisibility:
            battleVersion === 2 ? { kind: 'team-only', teamId: 'team:a' } : { kind: 'public' },
          eventVisibilityOverrides: [],
        })),
      }
      const result = await createViewerSafeBattleLogService(
        { findBattleEvents: async () => sourceRecords },
        { findBattleHistoryPrivacy: async () => authority },
      ).getLog(USER_ID, SESSION_ID)
      const ticks = result.entries.filter((entry) => entry.eventType === 'damage_applied')
      expect(ticks[0].actionId).toBe(sourceId)
      const tick = ticks[1]
      expect(tick).toMatchObject({
        actionId: null,
        periodicStatusId: statusId,
        templateValues: { amount: '4' },
      })
      expect(tick.headline).toBe(statusId[0].toUpperCase() + statusId.slice(1))
    },
  )
  it.each(['bleed', 'poison', 'burn'] as const)(
    'retains %s damage while proving its source from viewer-visible history',
    async (statusId) => {
      const sourceId = 'secret.periodic-skill'
      const originRecords = [
        { event: 'combat_action_used', actorId: ACTOR, actionId: sourceId },
        {
          event: 'persistent_effect_applied',
          sourceCombatantId: ACTOR,
          targetCombatantId: TARGET,
          actionId: sourceId,
          statusId,
        },
      ].map((event, eventIndex) => ({
        battleVersion: 1,
        eventIndex,
        createdAt: '2026-10-04T00:00:00Z',
        event,
      }))
      const tickRecord = {
        battleVersion: 2,
        eventIndex: 0,
        createdAt: '2026-10-04T00:00:01Z',
        event: {
          event: 'damage_applied',
          sourceCombatantId: ACTOR,
          targetCombatantId: TARGET,
          actionId: statusId === 'bleed' ? sourceId : `status.${statusId}.current.v1`,
          sourceActionId: sourceId,
          statusId,
          amount: 4,
        },
      }
      for (const scenario of [
        { hidden: true, allied: false, complete: true, attributed: false },
        { hidden: true, allied: true, complete: true, attributed: true },
        { hidden: false, allied: false, complete: true, attributed: true },
        { hidden: false, allied: false, complete: false, attributed: false },
      ]) {
        const sourceRecords = scenario.complete ? [...originRecords, tickRecord] : [tickRecord]
        const authority: BattleHistoryPrivacyAuthority = {
          viewer: deriveParticipantBattleViewerEntitlement(
            [
              { id: ACTOR, teamId: 'team:a' },
              { id: TARGET, teamId: 'team:b' },
            ],
            [scenario.allied ? ACTOR : TARGET],
          ),
          journals: [
            ...(scenario.complete
              ? [
                  {
                    schemaVersion: 1 as const,
                    battleVersion: 1,
                    actorCombatantId: ACTOR,
                    actorTeamId: 'team:a',
                    eventCount: 2,
                    commandVisibility: scenario.hidden
                      ? { kind: 'team-only' as const, teamId: 'team:a' }
                      : { kind: 'public' as const },
                    eventVisibilityOverrides: [],
                  },
                ]
              : []),
            {
              schemaVersion: 1,
              battleVersion: 2,
              actorCombatantId: TARGET,
              actorTeamId: 'team:b',
              eventCount: 1,
              commandVisibility: { kind: 'public' },
              eventVisibilityOverrides: [],
            },
          ],
        }
        const result = await createViewerSafeBattleLogService(
          { findBattleEvents: async () => sourceRecords },
          { findBattleHistoryPrivacy: async () => authority },
        ).getLog(USER_ID, SESSION_ID)
        const tick = result.entries.find((entry) => entry.eventType === 'damage_applied')!
        expect(tick).toMatchObject({
          actionId: scenario.attributed ? sourceId : null,
          periodicStatusId: statusId,
          templateValues: { amount: '4' },
        })
        if (!scenario.attributed) {
          expect(JSON.stringify(result)).not.toContain(sourceId)
          expect(tick.headline).toBe(statusId[0].toUpperCase() + statusId.slice(1))
        }
      }
    },
  )
  it('projects complete history before sanitization and does not leak a hidden Sensory action id', async () => {
    const eventRepository: BattleEventRepository = {
      findBattleEvents: vi.fn(async () => records),
    }
    const authority: BattleHistoryPrivacyAuthority = {
      viewer: deriveParticipantBattleViewerEntitlement(
        [
          { id: ACTOR, teamId: 'team:a' },
          { id: TARGET, teamId: 'team:b' },
        ],
        [TARGET],
      ),
      journals: [
        {
          schemaVersion: 1,
          battleVersion: 9,
          actorCombatantId: ACTOR,
          actorTeamId: 'team:a',
          eventCount: 5,
          commandVisibility: { kind: 'team-only', teamId: 'team:a' },
          eventVisibilityOverrides: [
            { eventIndex: 2, visibility: { kind: 'public' } },
            { eventIndex: 3, visibility: { kind: 'public' } },
          ],
        },
      ],
    }
    const privacyRepository: BattleHistoryPrivacyRepository = {
      findBattleHistoryPrivacy: vi.fn(async () => authority),
    }

    const result = await createViewerSafeBattleLogService(
      eventRepository,
      privacyRepository,
    ).getLog(USER_ID, SESSION_ID)

    expect(privacyRepository.findBattleHistoryPrivacy).toHaveBeenCalledWith(
      USER_ID,
      SESSION_ID,
      [9],
    )
    expect(result.entries.map((entry) => entry.eventType)).toEqual([
      'hidden_combat_action',
      'status_removed',
      'status_applied',
    ])
    expect(result.entries[0]).toEqual(
      expect.objectContaining({
        message: 'Wayfarer performed an action.',
        actorCombatantId: ACTOR,
        targetCombatantId: null,
        actionId: null,
        actionLabel: null,
        facts: [],
      }),
    )
    expect(JSON.stringify(result)).not.toContain('secret.sensory')
    expect(JSON.stringify(result)).not.toContain('damage_applied')
    expect(JSON.stringify(result)).not.toContain('combat_accuracy_resolved')
    expect(JSON.stringify(result)).not.toContain('MISSED')
    expect(JSON.stringify(result)).not.toContain('rollBasisPoints')
  })
})
