import { describe, expect, it } from 'vitest'
import type { BattleLogEntry } from '@/server/battle/battle-log-service'
import type { PresentedBattleLogAction, PresentedBattleLogRound } from './battle-log-presentation'
import { buildPresentedBattleLogTurns, resolveBattleLogTurnIndex } from './battle-log-turn-groups'

function action(
  version: number,
  turnNumber: number | null,
  round: number | null = 1,
): PresentedBattleLogAction {
  return {
    key: `action:${version}`,
    battleVersion: version,
    round,
    turnNumber,
    occurredAt: `2026-10-01T00:00:${String(version).padStart(2, '0')}Z`,
    kind: 'offense',
    tone: 'neutral',
    significance: 'standard',
    primary: [],
    secondary: null,
    details: [],
    ariaLabel: `Action ${version}`,
  }
}
function rounds(actions: PresentedBattleLogAction[]): PresentedBattleLogRound[] {
  return [{ key: 'round:1', round: 1, occurredAt: '', actions }]
}

describe('Battle Log turn browsing', () => {
  it('keeps every action in its annotated turn across rounds, ordered oldest to newest', () => {
    const turns = buildPresentedBattleLogTurns(
      rounds([action(5, 3, 2), action(4, 2), action(2, 1), action(3, 1)]),
      [],
    )
    expect(
      turns.map((turn) => [turn.round, turn.turnNumber, turn.actions.map((item) => item.key)]),
    ).toEqual([
      [1, 1, ['action:2', 'action:3']],
      [1, 2, ['action:4']],
      [2, 3, ['action:5']],
    ])
  })
  it('follows the newest turn by default and preserves a browsed turn when new actions arrive', () => {
    const before = buildPresentedBattleLogTurns(rounds([action(1, 1), action(2, 2)]), [])
    const after = buildPresentedBattleLogTurns(
      rounds([action(1, 1), action(2, 2), action(3, 3)]),
      [],
    )
    expect(resolveBattleLogTurnIndex(before, null)).toBe(1)
    expect(resolveBattleLogTurnIndex(after, null)).toBe(2)
    expect(resolveBattleLogTurnIndex(after, before[0]!.key)).toBe(0)
    expect(resolveBattleLogTurnIndex(after, 'missing')).toBe(2)
    expect(resolveBattleLogTurnIndex([], null)).toBe(-1)
  })
  it('retains legacy unannotated actions by round without inventing an actor turn', () => {
    const turns = buildPresentedBattleLogTurns(
      rounds([action(1, null, null), action(2, null), action(3, null, 2)]),
      [],
    )
    expect(turns.map((turn) => [turn.round, turn.turnNumber, turn.actions.length])).toEqual([
      [null, null, 1],
      [1, null, 1],
      [2, null, 1],
    ])
  })
  it('uses hidden turn starts for an empty latest turn and missing action annotations', () => {
    const entries = [
      { battleVersion: 1, eventIndex: 0, round: 1, turnNumber: 1, eventType: 'turn_started' },
      { battleVersion: 3, eventIndex: 0, round: 2, turnNumber: 2, eventType: 'turn_started' },
    ] as BattleLogEntry[]
    const turns = buildPresentedBattleLogTurns(rounds([action(2, null)]), entries)
    expect(turns.map((turn) => [turn.round, turn.turnNumber, turn.actions.length])).toEqual([
      [1, 1, 1],
      [2, 2, 0],
    ])
  })
  it('keeps separate turns that share a commit, using source event order', () => {
    const first = {
      ...action(2, 1),
      key: 'first',
      sourceEntries: [{ battleVersion: 2, eventIndex: 0 }] as BattleLogEntry[],
    }
    const second = {
      ...action(2, 2),
      key: 'second',
      sourceEntries: [{ battleVersion: 2, eventIndex: 2 }] as BattleLogEntry[],
    }
    const turns = buildPresentedBattleLogTurns(rounds([second, first]), [])
    expect(turns.map((turn) => turn.actions[0]?.key)).toEqual(['first', 'second'])
  })
})
