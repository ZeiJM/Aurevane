import { describe, expect, it } from 'vitest'

import { buildBattleLogActionNumbers } from './battle-log-feed'
import type { PresentedBattleLogAction, PresentedBattleLogRound } from './battle-log-presentation'

function action(key: string, battleVersion: number, occurredAt: string): PresentedBattleLogAction {
  return {
    key,
    battleVersion,
    round: battleVersion <= 5 ? 1 : 2,
    turnNumber: null,
    occurredAt,
    kind: 'offense',
    tone: 'neutral',
    significance: 'standard',
    primary: [],
    secondary: null,
    details: [],
    ariaLabel: key,
  }
}

describe('Battle Log display numbering', () => {
  it('numbers only player-facing actions contiguously from 1 even when battle versions skip', () => {
    const rounds: PresentedBattleLogRound[] = [
      {
        key: 'round:2',
        round: 2,
        occurredAt: '2026-08-31T17:50:12.000Z',
        actions: [
          action('battle:12', 12, '2026-08-31T17:50:12.000Z'),
          action('battle:11', 11, '2026-08-31T17:50:11.000Z'),
          action('battle:10', 10, '2026-08-31T17:50:10.000Z'),
          action('battle:8', 8, '2026-08-31T17:50:08.000Z'),
          action('battle:7', 7, '2026-08-31T17:50:07.000Z'),
        ],
      },
      {
        key: 'round:1',
        round: 1,
        occurredAt: '2026-08-31T17:49:05.000Z',
        actions: [
          action('battle:5', 5, '2026-08-31T17:49:05.000Z'),
          action('battle:4', 4, '2026-08-31T17:49:04.000Z'),
          action('battle:2', 2, '2026-08-31T17:49:02.000Z'),
        ],
      },
    ]

    const numbers = buildBattleLogActionNumbers(rounds)

    expect([...numbers.entries()]).toEqual([
      ['battle:2', 1],
      ['battle:4', 2],
      ['battle:5', 3],
      ['battle:7', 4],
      ['battle:8', 5],
      ['battle:10', 6],
      ['battle:11', 7],
      ['battle:12', 8],
    ])
  })
})
