import type { BattleEventRepository } from '@aurevane/db/battle-session'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createBattleLogService } from './battle-log-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'

describe('P2.5 sanitized battle log service', () => {
  it('projects committed events into readable entries without returning raw RNG/outcome payloads', async () => {
    const repository: BattleEventRepository = {
      findBattleEvents: vi.fn(async () => [
        {
          battleVersion: 8,
          eventIndex: 0,
          event: {
            event: 'recruit_ai_decision',
            combatantId: 'recruit:p2-4-1',
            reason: 'close-distance',
            utility: 28,
            candidateCount: 6,
            profileId: 'recruit-weak-v1',
            profileVersion: 1,
            rulesVersion: 1,
            tieBreakSeed: 999,
          },
          createdAt: '2026-08-17T13:01:00.000Z',
        },
        {
          battleVersion: 5,
          eventIndex: 3,
          event: {
            event: 'damage_applied',
            actionId: 'basic.attack.unarmed.basic',
            sourceCombatantId: 'character:player-1',
            targetCombatantId: 'recruit:p2-4-1',
            amount: 13,
            hpBefore: 80,
            hpAfter: 67,
          },
          createdAt: '2026-08-17T13:00:00.000Z',
        },
        {
          battleVersion: 5,
          eventIndex: 2,
          event: {
            event: 'stat_driven_attack_resolved',
            actorId: 'character:player-1',
            targetId: 'recruit:p2-4-1',
            hitChanceBasisPoints: 7400,
            rollBasisPoints: 1234,
            hit: true,
            defenseKind: 'armor',
            defenseRating: 20,
            rulesVersion: 1,
          },
          createdAt: '2026-08-17T13:00:00.000Z',
        },
        {
          battleVersion: 4,
          eventIndex: 0,
          event: {
            event: 'combatant_moved',
            combatantId: 'character:player-1',
            from: { x: 2, y: 1 },
            to: { x: 3, y: 1 },
            movementCost: 1,
          },
          createdAt: '2026-08-17T12:59:00.000Z',
        },
      ]),
    }

    const result = await createBattleLogService(repository).getLog(USER_ID, SESSION_ID)

    expect(result).toEqual({
      battleSessionId: SESSION_ID,
      entries: [
        {
          battleVersion: 8,
          eventIndex: 0,
          occurredAt: '2026-08-17T13:01:00.000Z',
          eventType: 'recruit_ai_decision',
          message: 'Recruit chose closing the distance.',
        },
        {
          battleVersion: 5,
          eventIndex: 3,
          occurredAt: '2026-08-17T13:00:00.000Z',
          eventType: 'damage_applied',
          message: 'Recruit took 13 damage and has 67 HP remaining.',
        },
        {
          battleVersion: 5,
          eventIndex: 2,
          occurredAt: '2026-08-17T13:00:00.000Z',
          eventType: 'stat_driven_attack_resolved',
          message: 'Wayfarer Basic Attack HIT (74% hit chance).',
        },
        {
          battleVersion: 4,
          eventIndex: 0,
          occurredAt: '2026-08-17T12:59:00.000Z',
          eventType: 'combatant_moved',
          message: 'Wayfarer moved from 3, 2 to 4, 2 for 1 Movement.',
        },
      ],
    })
    expect(repository.findBattleEvents).toHaveBeenCalledWith(USER_ID, SESSION_ID, 200)
    expect(JSON.stringify(result)).not.toContain('rollBasisPoints')
    expect(JSON.stringify(result)).not.toContain('hpBefore')
    expect(JSON.stringify(result)).not.toContain('hpAfter')
    expect(JSON.stringify(result)).not.toContain('candidateCount')
    expect(JSON.stringify(result)).not.toContain('tieBreakSeed')
    expect(JSON.stringify(result)).not.toContain('profileId')
    expect(JSON.stringify(result)).not.toContain('raw')
  })

  it('drops internal low-level events that are not useful to the player log', async () => {
    const repository: BattleEventRepository = {
      findBattleEvents: vi.fn(async () => [
        {
          battleVersion: 2,
          eventIndex: 0,
          event: { event: 'action_spent', combatantId: 'character:player-1' },
          createdAt: '2026-08-17T13:00:00.000Z',
        },
      ]),
    }

    const result = await createBattleLogService(repository).getLog(USER_ID, SESSION_ID)
    expect(result.entries).toEqual([])
  })
})
