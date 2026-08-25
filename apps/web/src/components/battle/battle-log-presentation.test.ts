import { describe, expect, it } from 'vitest'

import type { BattleLogEntry } from '@/server/battle/battle-log-service'

import { buildBattleLogPresentation } from './battle-log-presentation'

function entry(overrides: Partial<BattleLogEntry> = {}): BattleLogEntry {
  return {
    battleVersion: 1,
    eventIndex: 0,
    occurredAt: '2026-08-24T22:00:00.000Z',
    eventType: 'combat_action_used',
    message: 'Wayfarer used Basic Attack.',
    messageTemplate: '{actor} used {action}.',
    templateValues: { action: 'Basic Attack' },
    actorCombatantId: 'character:zei',
    targetCombatantId: null,
    actionId: 'basic.attack.unarmed.basic',
    actionLabel: 'Basic Attack',
    round: 4,
    turnNumber: 7,
    kind: 'offense',
    headline: 'Basic Attack',
    tone: 'neutral',
    facts: [],
    ...overrides,
  }
}

const names = {
  'character:zei': 'Zei',
  'character:storm': 'Storm',
}

function sentence(segments: readonly { text: string }[]): string {
  return segments.map((segment) => segment.text).join('')
}

describe('Battle Log V2 presentation', () => {
  it('turns a hit, damage, and status consequence into one readable combat beat', () => {
    const rounds = buildBattleLogPresentation(
      [
        entry({ eventIndex: 0 }),
        entry({
          eventIndex: 1,
          eventType: 'stat_driven_attack_resolved',
          message: 'Wayfarer Basic Attack HIT.',
          messageTemplate: '{actor} {action} {outcome}.',
          templateValues: { action: 'Basic Attack', outcome: 'HIT' },
          targetCombatantId: 'character:storm',
          tone: 'damage',
          facts: [
            { label: 'HIT', tone: 'damage' },
            { label: '74% hit', tone: 'neutral' },
          ],
        }),
        entry({
          eventIndex: 2,
          eventType: 'damage_applied',
          message: 'Storm took 18 damage.',
          messageTemplate: '{target} took {amount} damage.',
          templateValues: { amount: '18' },
          targetCombatantId: 'character:storm',
          tone: 'damage',
          facts: [
            { label: '18 DMG', tone: 'damage' },
            { label: '82 HP', tone: 'neutral' },
          ],
        }),
        entry({
          eventIndex: 3,
          eventType: 'status_applied',
          message: 'Storm gained Lowered Guard.',
          messageTemplate: '{target} gained {status}.',
          templateValues: { status: 'Lowered Guard' },
          actorCombatantId: null,
          targetCombatantId: 'character:storm',
          actionId: null,
          actionLabel: null,
          kind: 'status',
          headline: 'Lowered Guard',
          tone: 'warning',
          facts: [
            { label: 'Lowered Guard', tone: 'warning' },
            { label: '2 turns', tone: 'neutral' },
          ],
        }),
      ],
      { combatantNames: names },
    )

    const action = rounds[0]?.actions[0]
    expect(action).toBeDefined()
    expect(sentence(action?.primary ?? [])).toBe('Zei strikes Storm — 18 damage')
    expect(sentence(action?.secondary ?? [])).toBe('↳ Storm suffers Lowered Guard · 2 turns')
    expect(action?.details.map((detail) => detail.label)).toEqual(['82 HP', '74% hit'])
    expect(action?.ariaLabel).toBe('Zei strikes Storm — 18 damage Storm suffers Lowered Guard · 2 turns')
  })

  it('explains a timeout without leaking duplicate status pills or absurd raw durations', () => {
    const rounds = buildBattleLogPresentation(
      [
        entry({
          battleVersion: 204,
          eventIndex: 0,
          eventType: 'pvp_turn_timed_out',
          message: 'Wayfarer timed out.',
          messageTemplate: '{actor} timed out.',
          actionId: null,
          actionLabel: null,
          targetCombatantId: null,
          kind: 'turn',
          headline: 'Turn Timeout',
          tone: 'warning',
          facts: [{ label: '2 misses', tone: 'warning' }],
        }),
        entry({
          battleVersion: 204,
          eventIndex: 1,
          eventType: 'pvp_lowered_guard_applied',
          message: 'Wayfarer gained Lowered Guard.',
          messageTemplate: '{target} gained Lowered Guard.',
          templateValues: {},
          actorCombatantId: null,
          targetCombatantId: 'character:zei',
          actionId: null,
          actionLabel: null,
          kind: 'status',
          headline: 'Lowered Guard',
          tone: 'warning',
          facts: [{ label: 'Lowered Guard', tone: 'warning' }],
        }),
        entry({
          battleVersion: 204,
          eventIndex: 2,
          eventType: 'status_applied',
          message: 'Wayfarer gained Lowered Guard for 1000 owner-turn starts.',
          messageTemplate: '{target} gained {status}.',
          templateValues: { status: 'Lowered Guard' },
          actorCombatantId: null,
          targetCombatantId: 'character:zei',
          actionId: null,
          actionLabel: null,
          kind: 'status',
          headline: 'Lowered Guard',
          tone: 'warning',
          facts: [
            { label: 'Lowered Guard', tone: 'warning' },
            { label: '1000 turns', tone: 'neutral' },
          ],
        }),
      ],
      { combatantNames: names },
    )

    const action = rounds[0]?.actions[0]
    expect(sentence(action?.primary ?? [])).toBe("Zei's turn expires — action forfeited")
    expect(sentence(action?.secondary ?? [])).toBe('↳ Zei suffers Lowered Guard')
    expect(action?.details.map((detail) => detail.label)).toEqual(['2 misses'])
    expect(JSON.stringify(action)).not.toContain('1000 turns')
  })

  it('renders a miss as a sentence instead of a headline plus outcome pills', () => {
    const rounds = buildBattleLogPresentation(
      [
        entry({
          eventType: 'stat_driven_attack_resolved',
          message: 'Wayfarer Basic Attack MISSED.',
          messageTemplate: '{actor} {action} {outcome}.',
          templateValues: { action: 'Basic Attack', outcome: 'MISSED' },
          targetCombatantId: 'character:storm',
          tone: 'warning',
          facts: [
            { label: 'MISS', tone: 'warning' },
            { label: '61% hit', tone: 'neutral' },
          ],
        }),
      ],
      { combatantNames: names },
    )

    const action = rounds[0]?.actions[0]
    expect(sentence(action?.primary ?? [])).toBe('Zei strikes Storm — Miss')
    expect(action?.secondary).toBeNull()
    expect(action?.details.map((detail) => detail.label)).toEqual(['61% hit'])
  })
})
