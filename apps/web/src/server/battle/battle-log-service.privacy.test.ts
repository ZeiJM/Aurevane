import type { BattleEventRepository } from '@aurevane/db/battle-session'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type {
  BattleHistoryPrivacyAuthority,
  BattleHistoryPrivacyRepository,
} from './battle-history-privacy-authority'
import { createBattleLogService } from './battle-log-service'
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
] as const

describe('CSR-3 battle log privacy integration', () => {
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
          eventCount: 4,
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

    const result = await createBattleLogService(eventRepository, privacyRepository).getLog(
      USER_ID,
      SESSION_ID,
    )

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
  })
})
