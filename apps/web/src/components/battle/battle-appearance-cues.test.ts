import { describe, expect, it, vi } from 'vitest'
import { PV1F_BASIC_ATTACK_ID } from '@aurevane/game-core/combat/pv1f-skills'
import { buildBattleLogView } from '@/server/battle/battle-log-service'
import { battleAppearanceCues } from './battle-appearance-cues'

vi.mock('server-only', () => ({}))

describe('battle actor cues', () => {
  it('plays only committed viewer-visible receipts for the displayed version', () => {
    const event = {
      battleVersion: 7,
      eventIndex: 1,
      actorCombatantId: 'scout',
      targetCombatantId: 'guard',
      actionId: PV1F_BASIC_ATTACK_ID,
      templateValues: { amount: '10' },
      eventType: 'combat_action_used',
    }
    const cues = battleAppearanceCues(
      [
        { ...event, battleVersion: 6, actorCombatantId: 'old' },
        { ...event, eventType: 'hidden_combat_action', actorCombatantId: 'hidden' },
        event,
        { ...event, eventIndex: 2, eventType: 'damage_applied' },
        { ...event, eventIndex: 3, eventType: 'combatant_moved' },
      ],
      7,
    )
    expect([...cues]).toEqual([
      ['scout', { key: '7:1', pose: 'attack' }],
      ['guard', { key: '7:2', pose: 'hit' }],
    ])
  })

  it('reads Basic Attack from the real Chronicle projection', () => {
    const actionId = PV1F_BASIC_ATTACK_ID
    const log = buildBattleLogView('battle', [
      {
        event: {
          event: 'combat_action_used',
          actorId: 'scout',
          actionId,
        },
        battleVersion: 7,
        eventIndex: 1,
        createdAt: '2026-11-07T00:00:00Z',
      },
    ])
    expect(battleAppearanceCues(log.entries, 7).get('scout')?.pose).toBe('attack')
  })
})
