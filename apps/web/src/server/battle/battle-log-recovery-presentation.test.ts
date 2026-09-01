import type { BattleEventRecord } from '@aurevane/db/battle-session'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { buildBattleLogView } from './battle-log-service'

const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const PLAYER_ID = 'character:player-1'

function record(
  battleVersion: number,
  eventIndex: number,
  event: BattleEventRecord['event'],
): BattleEventRecord {
  return {
    battleVersion,
    eventIndex,
    event,
    createdAt: `2026-09-01T00:00:0${battleVersion}.000Z`,
  }
}

describe('Recovery battle log presentation', () => {
  it('uses the HP Recovery and MP Recovery names and healing semantics', () => {
    const result = buildBattleLogView(SESSION_ID, [
      record(1, 0, {
        event: 'combat_action_used',
        actionId: 'basic.recover',
        actorId: PLAYER_ID,
      }),
      record(1, 1, {
        event: 'healing_applied',
        actionId: 'basic.recover',
        sourceCombatantId: PLAYER_ID,
        targetCombatantId: PLAYER_ID,
        amount: 5,
        hpBefore: 20,
        hpAfter: 25,
      }),
      record(2, 0, {
        event: 'combat_action_used',
        actionId: 'basic.recover.mp',
        actorId: PLAYER_ID,
      }),
      record(2, 1, {
        event: 'resource_changed',
        actionId: 'basic.recover.mp',
        sourceCombatantId: PLAYER_ID,
        targetCombatantId: PLAYER_ID,
        resource: 'mp',
        delta: 2,
        before: 5,
        after: 7,
      }),
    ])

    const hpAction = result.entries.find(
      (entry) => entry.eventType === 'combat_action_used' && entry.actionId === 'basic.recover',
    )
    expect(hpAction).toEqual(
      expect.objectContaining({
        actionLabel: 'HP Recovery',
        headline: 'HP Recovery',
        kind: 'recovery',
        message: 'Wayfarer used HP Recovery.',
      }),
    )

    const hpRecovery = result.entries.find((entry) => entry.eventType === 'healing_applied')
    expect(hpRecovery).toEqual(
      expect.objectContaining({
        actionLabel: 'HP Recovery',
        headline: 'HP Recovery',
        kind: 'recovery',
        tone: 'healing',
      }),
    )

    const mpAction = result.entries.find(
      (entry) => entry.eventType === 'combat_action_used' && entry.actionId === 'basic.recover.mp',
    )
    expect(mpAction).toEqual(
      expect.objectContaining({
        actionLabel: 'MP Recovery',
        headline: 'MP Recovery',
        kind: 'recovery',
        message: 'Wayfarer used MP Recovery.',
      }),
    )

    const mpRecovery = result.entries.find((entry) => entry.eventType === 'resource_changed')
    expect(mpRecovery).toEqual(
      expect.objectContaining({
        actorCombatantId: PLAYER_ID,
        targetCombatantId: PLAYER_ID,
        actionId: 'basic.recover.mp',
        actionLabel: 'MP Recovery',
        headline: 'MP Recovery',
        kind: 'recovery',
        tone: 'healing',
        message: 'Wayfarer recovered 2 MP.',
        facts: [{ label: '+2 MP', tone: 'healing' }],
      }),
    )
  })
})
