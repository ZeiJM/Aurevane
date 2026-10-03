import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { BattleLogEntry } from '@/server/battle/battle-log-service'

import {
  BattleLogFeed,
  BattleLogTranscriptAction,
  buildBattleLogActionNumbers,
  buildBattleLogTranscriptLines,
  countBattleLogActions,
  selectRecentBattleLogEntries,
} from './battle-log-feed'
import { summarizeConsecutiveBattleLogMovement } from './battle-log-movement-summary'
import { BattleActionTimeline } from './battle-action-timeline'
import { buildBattleLogPresentation } from './battle-log-presentation'
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

function movementEntry(
  battleVersion: number,
  actorCombatantId: string,
  turnNumber = 3,
): BattleLogEntry {
  return {
    battleVersion,
    eventIndex: 0,
    occurredAt: `2026-08-31T17:50:${String(battleVersion).padStart(2, '0')}.000Z`,
    eventType: 'combatant_moved',
    message: 'Combatant moved.',
    messageTemplate: '{actor} moved.',
    templateValues: {},
    actorCombatantId,
    targetCombatantId: null,
    actionId: null,
    actionLabel: null,
    round: 2,
    turnNumber,
    kind: 'movement',
    headline: 'Move',
    tone: 'neutral',
    facts: [],
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

  it('counts a continuous same-character path as one movement action', () => {
    const entries = [
      movementEntry(7, 'character:zei'),
      movementEntry(6, 'character:zei'),
      movementEntry(5, 'character:zei'),
    ]

    expect(countBattleLogActions(entries)).toBe(1)
  })

  it('does not merge movement from different characters or different turns', () => {
    const entries = [
      movementEntry(8, 'character:storm', 4),
      movementEntry(7, 'character:zei', 4),
      movementEntry(6, 'character:zei', 3),
      movementEntry(5, 'character:zei', 3),
    ]

    expect(countBattleLogActions(entries)).toBe(3)
  })

  it('keeps only one visible movement beat for consecutive path steps', () => {
    const newestMove = {
      ...action('battle:7', 7, '2026-08-31T17:50:07.000Z'),
      round: 2,
      turnNumber: 3,
      kind: 'movement' as const,
    }
    const olderMove = {
      ...action('battle:6', 6, '2026-08-31T17:50:06.000Z'),
      round: 2,
      turnNumber: 3,
      kind: 'movement' as const,
    }
    const rounds: PresentedBattleLogRound[] = [
      {
        key: 'round:2',
        round: 2,
        occurredAt: newestMove.occurredAt,
        actions: [newestMove, olderMove],
      },
    ]
    const entries = [movementEntry(7, 'character:zei'), movementEntry(6, 'character:zei')]

    const summarized = summarizeConsecutiveBattleLogMovement(rounds, entries)
    expect(summarized[0]?.actions.map((item) => item.key)).toEqual(['battle:7'])
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

// The chronicle supersedes the old recent-turn window and shows all non-bookkeeping techniques.
describe('Battle Log complete chronicle and legacy history selection', () => {
  const combatantNames = Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7].map((turn) => [`character:unit-${turn}`, `Actor${turn}`]),
  )
  const entries: BattleLogEntry[] = [6, 5, 4, 3, 2, 1].map((turn) => ({
    ...movementEntry(turn * 2, `character:unit-${turn}`, turn),
    round: 1,
  }))

  it('keeps all six actors techniques in compact and complete readers without pagination', () => {
    const techniques = entries.map((entry) => ({
      ...entry,
      eventType: 'combat_action_used',
      kind: 'offense' as const,
      actionId: 'basic.attack.unarmed.basic',
      actionLabel: 'Basic Attack',
    }))
    for (const compactFlow of [true, false]) {
      const html = renderToStaticMarkup(
        <BattleLogFeed
          entries={techniques}
          combatantNames={combatantNames}
          compactFlow={compactFlow}
          recentTurnCount={4}
        />,
      )
      for (let actor = 1; actor <= 6; actor++) expect(html).toContain(`Actor${actor}`)
      expect(html).toContain('data-battle-chronicle="true"')
      expect(html).not.toContain('Previous turn')
      expect(html).not.toContain('In progress')
    }
  })

  it('leaves a movement-only history empty without deleting the recorded entries', () => {
    const html = renderToStaticMarkup(
      <BattleLogFeed entries={entries} combatantNames={combatantNames} />,
    )
    expect(html).toContain('No committed battle actions yet.')
    expect(html).not.toContain('Actor6')
    expect(entries).toHaveLength(6)
  })

  it('keeps only recent entries within a handoff commit and retains recent untagged boundary effects', () => {
    const history: BattleLogEntry[] = [
      ...entries.filter((entry) => entry.turnNumber !== 2 && entry.turnNumber !== 3),
      { ...movementEntry(6, 'character:unit-3', 3), round: 1, eventIndex: 1 },
      { ...movementEntry(6, 'character:unit-2', 2), round: 1, eventIndex: 0 },
      {
        ...movementEntry(7, 'character:unit-3', 3),
        turnNumber: null,
        round: 1,
        eventType: 'status_expired',
      },
      {
        ...movementEntry(1, 'character:unit-1', 1),
        turnNumber: null,
        round: 1,
        eventType: 'status_expired',
      },
    ]
    const recent = selectRecentBattleLogEntries(history, 4)
    expect(recent.map((entry) => `${entry.battleVersion}:${entry.eventIndex}`)).toEqual([
      '12:0',
      '10:0',
      '8:0',
      '6:1',
      '7:0',
    ])
    expect(history).toHaveLength(8)
    expect(selectRecentBattleLogEntries(history)).toBe(history)
  })

  it('retains every command in the included turns instead of limiting to four actions', () => {
    const history = [
      movementEntry(14, 'character:unit-6', 6),
      movementEntry(13, 'character:unit-6', 6),
      ...entries,
    ]
    expect(selectRecentBattleLogEntries(history, 4).map((entry) => entry.battleVersion)).toEqual([
      14, 13, 12, 10, 8, 6,
    ])
    expect(selectRecentBattleLogEntries(history, 4, 20)).toEqual([])
  })
})

describe('Battle Flow rich Text log', () => {
  it('reads one selected action inline without opening named-effect popups', () => {
    const guard: PresentedBattleLogAction = {
      ...action('battle:9', 9, '2026-08-31T17:50:09.000Z'),
      kind: 'defense',
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
    }
    const markup = renderToStaticMarkup(
      <BattleActionTimeline
        rounds={[{ key: 'round:2', round: 2, occurredAt: guard.occurredAt, actions: [guard] }]}
        entries={[]}
        view="text"
      />,
    )
    expect(markup).toContain('Battle action transcript')
    expect(markup).toContain('Round 2')
    expect(markup).toContain('Recorded action result')
    expect(markup).toContain('Guarded')
    expect(markup).not.toContain('data-battle-effect-trigger')
    expect(markup).not.toContain('<dialog')
    expect(markup).not.toContain('Recent 4 turns')
    expect(markup).not.toContain('Filter battle actions')
    expect(markup).not.toContain('Zei · R2')
  })

  it('exposes Guarded when a live action line arrives as an untyped primary segment', () => {
    const status: PresentedBattleLogAction = {
      ...action('battle:10', 10, '2026-08-31T17:50:10.000Z'),
      primary: [{ text: 'Guarded', role: 'text' }],
    }
    const markup = renderToStaticMarkup(<BattleLogTranscriptAction action={status} number={10} />)

    expect(markup).toContain('data-battle-effect-name="Guarded"')
    expect(markup).toContain('aria-label="Explain Guarded"')
  })

  it('keeps the abbreviated summary and complete recorded movement coordinates accessible inline', () => {
    const moved = {
      ...movementEntry(2, 'character:zei'),
      message: 'Zei moves from (1, 2) to (2, 2).',
      messageTemplate: '{actor} moves from (1, 2) to (2, 2).',
    }
    const rounds = buildBattleLogPresentation([moved], {
      combatantNames: { 'character:zei': 'Zei' },
    })
    const markup = renderToStaticMarkup(
      <BattleActionTimeline rounds={rounds} entries={[moved]} view="text" />,
    )
    expect(markup).toContain('Zei moves')
    expect(markup).toContain('(1, 2)')
    expect(markup).toContain('(2, 2)')
    expect(moved.message).toContain('from (1, 2) to (2, 2)')
  })

  it('pages an overflowing turn while retaining all twelve actions', () => {
    const actions = Array.from({ length: 12 }, (_, index) => ({
      ...action(`action:${index}`, index + 1, '2026-10-01T00:00:00Z'),
      round: 1,
      turnNumber: 1,
    }))
    const markup = renderToStaticMarkup(
      <BattleActionTimeline
        rounds={[{ key: 'round:1', round: 1, occurredAt: '', actions }]}
        entries={[]}
      />,
    )
    expect(actions).toHaveLength(12)
    expect((markup.match(/title="action:/g) ?? []).length).toBe(4)
    expect(markup).toContain('Actions 9–12 / 12')
    expect(markup).toContain('Previous actions')
    expect(markup).toContain('Next actions')
    expect(markup).not.toContain('<strong>Attack</strong>')
    expect(markup).not.toContain('<span>Battle</span>')
    expect(markup).not.toContain('Filter battle actions')
    expect(markup).not.toContain('Battle history pages')
    expect(markup).not.toContain('Previous turn')
    expect(markup).not.toContain('Next turn')
    expect(markup).toContain('Turn 1')
  })
})
