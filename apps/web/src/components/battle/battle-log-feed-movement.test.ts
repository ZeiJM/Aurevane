import { describe, expect, it } from 'vitest'

import type { BattleLogEntry } from '@/server/battle/battle-log-service'

import { countBattleLogActions } from './battle-log-feed'

function movementEntry(): BattleLogEntry {
  return {
    battleVersion: 12,
    eventIndex: 0,
    occurredAt: '2026-08-31T17:00:00.000Z',
    eventType: 'combatant_moved',
    message: 'Wayfarer moved from 2, 4 to 4, 4 for 3 Movement.',
    messageTemplate: '{actor} moved from 2, 4 to 4, 4.',
    templateValues: {},
    actorCombatantId: 'character:zei',
    targetCombatantId: null,
    actionId: null,
    actionLabel: null,
    round: 3,
    turnNumber: 5,
    kind: 'movement',
    headline: 'Move',
    tone: 'neutral',
    facts: [
      { label: '2, 4 → 4, 4', tone: 'neutral' },
      { label: '3 Move spent', tone: 'neutral' },
    ],
  }
}

describe('Battle Log feed movement', () => {
  it('keeps committed movement as a player-facing action', () => {
    expect(countBattleLogActions([movementEntry()])).toBe(1)
  })
})
