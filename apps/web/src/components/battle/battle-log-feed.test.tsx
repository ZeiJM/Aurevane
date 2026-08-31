import { describe, expect, it } from 'vitest'

import {
  buildBattleLogActionNumbers,
  buildBattleLogTranscriptLines,
} from './battle-log-feed'
import type {
  BattleLogSegment,
  PresentedBattleLogAction,
  PresentedBattleLogRound,
} from './battle-log-presentation'

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

function sentence(segments: readonly BattleLogSegment[]): string {
  return segments.map((segment) => segment.text).join('')
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

describe('Battle Log transcript consequence layout', () => {
  it('moves attack damage beneath the action and keeps status consequences stacked after it', () => {
    const base = action('battle:6', 6, '2026-08-31T17:50:06.000Z')
    const transcript = buildBattleLogTranscriptLines({
      ...base,
      tone: 'damage',
      primary: [
        { text: 'Zei', role: 'actor' },
        { text: ' strikes ' },
        { text: 'Recruit', role: 'target' },
        { text: ' — ' },
        { text: '14 damage', role: 'outcome', tone: 'damage' },
      ],
      secondary: [
        { text: '↳ ' },
        { text: 'Recruit', role: 'target' },
        { text: ' suffers ' },
        { text: 'Lowered Guard', role: 'outcome', tone: 'warning' },
        { text: ' · 2 turns' },
      ],
    })

    expect(sentence(transcript.primary)).toBe('Zei strikes Recruit')
    expect(transcript.secondaryLines.map(sentence)).toEqual([
      '↳ Recruit takes 14 damage',
      '↳ Recruit suffers Lowered Guard · 2 turns',
    ])
  })

  it('moves a miss beneath the attack line instead of crowding the action sentence', () => {
    const base = action('battle:7', 7, '2026-08-31T17:50:07.000Z')
    const transcript = buildBattleLogTranscriptLines({
      ...base,
      tone: 'warning',
      primary: [
        { text: 'Zei', role: 'actor' },
        { text: ' strikes ' },
        { text: 'Recruit', role: 'target' },
        { text: ' — ' },
        { text: 'Miss', role: 'outcome', tone: 'warning' },
      ],
    })

    expect(sentence(transcript.primary)).toBe('Zei strikes Recruit')
    expect(transcript.secondaryLines.map(sentence)).toEqual(['↳ Miss'])
  })

  it('moves healing beneath recovery prose while preserving healing tone metadata', () => {
    const base = action('battle:8', 8, '2026-08-31T17:50:08.000Z')
    const transcript = buildBattleLogTranscriptLines({
      ...base,
      kind: 'recovery',
      tone: 'healing',
      primary: [
        { text: 'Zei', role: 'actor' },
        { text: ' recovers — ' },
        { text: '+12 HP', role: 'outcome', tone: 'healing' },
      ],
    })

    expect(sentence(transcript.primary)).toBe('Zei recovers')
    expect(transcript.secondaryLines.map(sentence)).toEqual(['↳ Zei recovers +12 HP'])
    expect(transcript.secondaryLines[0]?.at(-1)?.tone).toBe('healing')
  })

  it('leaves Guard in its existing action then status format', () => {
    const base = action('battle:9', 9, '2026-08-31T17:50:09.000Z')
    const transcript = buildBattleLogTranscriptLines({
      ...base,
      kind: 'defense',
      tone: 'benefit',
      primary: [
        { text: 'Zei', role: 'actor' },
        { text: ' braces with ' },
        { text: 'Guard', role: 'action' },
      ],
      secondary: [
        { text: '↳ ' },
        { text: 'Zei', role: 'target' },
        { text: ' gains ' },
        { text: 'Guarded', role: 'outcome', tone: 'benefit' },
        { text: ' · 1 turn' },
      ],
    })

    expect(sentence(transcript.primary)).toBe('Zei braces with Guard')
    expect(transcript.secondaryLines.map(sentence)).toEqual(['↳ Zei gains Guarded · 1 turn'])
  })
})
