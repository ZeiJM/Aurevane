import { describe, expect, it } from 'vitest'

import type { PresentedBattleLogAction, PresentedBattleLogRound } from './battle-log-presentation'
import { consolidatePresentedBattleLogRounds } from './battle-log-round-groups'

function action(key: string, round: number, battleVersion: number): PresentedBattleLogAction {
  return {
    key,
    battleVersion,
    round,
    turnNumber: battleVersion,
    occurredAt: `2026-08-25T22:${String(battleVersion).padStart(2, '0')}:00.000Z`,
    kind: 'turn',
    tone: 'neutral',
    significance: 'standard',
    primary: [{ text: key }],
    secondary: null,
    details: [],
    ariaLabel: key,
  }
}

function round(
  roundNumber: number,
  battleVersion: number,
  actionKey: string,
): PresentedBattleLogRound {
  const item = action(actionKey, roundNumber, battleVersion)
  return {
    key: `round:${roundNumber}`,
    round: roundNumber,
    occurredAt: item.occurredAt,
    actions: [item],
  }
}

describe('Battle Log round grouping', () => {
  it('merges non-contiguous duplicate round sections and orders numbered rounds newest-first', () => {
    const result = consolidatePresentedBattleLogRounds([
      round(3, 9, 'r3-new'),
      round(2, 8, 'r2-new'),
      round(1, 7, 'r1-new'),
      round(3, 6, 'r3-old'),
      round(2, 5, 'r2-old'),
      round(1, 4, 'r1-old'),
    ])

    expect(result.map((group) => group.key)).toEqual(['round:3', 'round:2', 'round:1'])
    expect(result.map((group) => group.actions.length)).toEqual([2, 2, 2])
    expect(result[0]?.actions.map((item) => item.key)).toEqual(['r3-new', 'r3-old'])
    expect(result[1]?.actions.map((item) => item.key)).toEqual(['r2-new', 'r2-old'])
    expect(result[2]?.actions.map((item) => item.key)).toEqual(['r1-new', 'r1-old'])
  })

  it('keeps a roundless Battle section after numbered rounds', () => {
    const battle: PresentedBattleLogRound = {
      key: 'battle',
      round: null,
      occurredAt: '2026-08-25T21:00:00.000Z',
      actions: [action('battle-event', 0, 1)],
    }

    const result = consolidatePresentedBattleLogRounds([battle, round(1, 2, 'round-one')])

    expect(result.map((group) => group.key)).toEqual(['round:1', 'battle'])
  })
})
