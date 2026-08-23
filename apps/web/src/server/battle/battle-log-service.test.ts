import type { BattleEventRepository } from '@aurevane/db/battle-session'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createBattleLogService } from './battle-log-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'

describe('sanitized battle log service', () => {
  it('projects committed events into rich readable entries without returning raw resolution payloads', async () => {
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

    expect(result.battleSessionId).toBe(SESSION_ID)
    expect(result.entries).toHaveLength(4)
    expect(result.entries[1]).toEqual(
      expect.objectContaining({
        battleVersion: 5,
        eventIndex: 3,
        eventType: 'damage_applied',
        message: 'Recruit took 13 damage and has 67 HP remaining.',
        messageTemplate: '{target} took {amount} damage.',
        templateValues: { amount: '13' },
        actorCombatantId: 'character:player-1',
        targetCombatantId: 'recruit:p2-4-1',
        actionId: 'basic.attack.unarmed.basic',
        actionLabel: 'Basic Attack',
        kind: 'offense',
        headline: 'Basic Attack',
        tone: 'damage',
        facts: [
          { label: '13 DMG', tone: 'damage' },
          { label: '67 HP', tone: 'neutral' },
        ],
      }),
    )
    expect(result.entries[2]).toEqual(
      expect.objectContaining({
        eventType: 'stat_driven_attack_resolved',
        messageTemplate: '{actor} {action} {outcome}.',
        actorCombatantId: 'character:player-1',
        targetCombatantId: 'recruit:p2-4-1',
        actionLabel: 'Basic Attack',
        facts: [
          { label: 'HIT', tone: 'damage' },
          { label: '74% hit', tone: 'neutral' },
        ],
      }),
    )
    expect(result.entries[3]).toEqual(
      expect.objectContaining({
        eventType: 'combatant_moved',
        actorCombatantId: 'character:player-1',
        kind: 'movement',
        headline: 'Move',
        facts: [
          { label: '3, 2 → 4, 2', tone: 'neutral' },
          { label: '1 Move', tone: 'neutral' },
        ],
      }),
    )
    expect(repository.findBattleEvents).toHaveBeenCalledWith(USER_ID, SESSION_ID, 100)

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('rollBasisPoints')
    expect(serialized).not.toContain('hpBefore')
    expect(serialized).not.toContain('hpAfter')
    expect(serialized).not.toContain('candidateCount')
    expect(serialized).not.toContain('tieBreakSeed')
    expect(serialized).not.toContain('profileId')
    expect(serialized).not.toContain('raw')
  })

  it('carries authoritative round and turn context forward into later action entries', async () => {
    const repository: BattleEventRepository = {
      findBattleEvents: vi.fn(async () => [
        {
          battleVersion: 3,
          eventIndex: 0,
          event: {
            event: 'combatant_moved',
            combatantId: 'character:player-1',
            from: { x: 0, y: 0 },
            to: { x: 1, y: 0 },
            movementCost: 1,
          },
          createdAt: '2026-08-17T13:02:00.000Z',
        },
        {
          battleVersion: 2,
          eventIndex: 0,
          event: {
            event: 'turn_started',
            combatantId: 'character:player-1',
            round: 2,
            turnNumber: 4,
          },
          createdAt: '2026-08-17T13:01:00.000Z',
        },
        {
          battleVersion: 1,
          eventIndex: 0,
          event: { event: 'round_started', round: 2 },
          createdAt: '2026-08-17T13:00:00.000Z',
        },
      ]),
    }

    const result = await createBattleLogService(repository).getLog(USER_ID, SESSION_ID)

    expect(result.entries[0]).toEqual(
      expect.objectContaining({
        eventType: 'combatant_moved',
        round: 2,
        turnNumber: 4,
      }),
    )
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
