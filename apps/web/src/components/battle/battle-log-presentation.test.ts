import type { SkillNarrationTemplate } from '@aurevane/game-core/combat/battle-narration'
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

function attackEntries(overrides: Partial<BattleLogEntry> = {}): BattleLogEntry[] {
  return [
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
        { label: '74% hit chance', tone: 'neutral' },
      ],
      ...overrides,
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
        { label: '82 HP remaining', tone: 'neutral' },
      ],
      ...overrides,
    }),
  ]
}

describe('Battle Log V2 presentation', () => {
  it('turns a hit, damage, and status consequence into one readable combat beat', () => {
    const rounds = buildBattleLogPresentation(
      [
        entry({ eventIndex: 0 }),
        ...attackEntries(),
        entry({
          eventIndex: 3,
          eventType: 'status_applied',
          message: 'Storm gained Lowered Guard.',
          messageTemplate: '{target} gained {status}.',
          templateValues: { status: 'Lowered Guard', statusChange: 'APPLIED' },
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
    expect(sentence(action?.primary ?? [])).toBe('Zei strikes Storm — 18 damage')
    expect(sentence(action?.secondary ?? [])).toBe('↳ Storm suffers Lowered Guard · 2 turns')
    expect(action?.details.map((detail) => detail.label)).toEqual([
      '82 HP remaining',
      '74% hit chance',
    ])
    expect(action?.ariaLabel).toBe(
      'Zei strikes Storm — 18 damage Storm suffers Lowered Guard · 2 turns',
    )
  })

  it('uses PvP participant identity instead of falling back to the viewer name', () => {
    const action = buildBattleLogPresentation(attackEntries(), { combatantNames: names })[0]
      ?.actions[0]
    expect(sentence(action?.primary ?? [])).toBe('Zei strikes Storm — 18 damage')
  })

  it('uses Opponent rather than the viewer name when a PvP name map is incomplete', () => {
    const action = buildBattleLogPresentation(attackEntries(), {
      playerName: 'Zei',
      combatantNames: { 'character:zei': 'Zei' },
    })[0]?.actions[0]
    expect(sentence(action?.primary ?? [])).toBe('Zei strikes Opponent — 18 damage')
  })

  it('keeps genuine self-damage distinct from a targeting bug', () => {
    const action = buildBattleLogPresentation(
      [
        entry({
          eventType: 'damage_applied',
          actorCombatantId: 'character:zei',
          targetCombatantId: 'character:zei',
          templateValues: { amount: '12' },
          facts: [
            { label: '12 DMG', tone: 'damage' },
            { label: '88 HP remaining', tone: 'neutral' },
          ],
          tone: 'damage',
        }),
      ],
      { combatantNames: names },
    )[0]?.actions[0]
    expect(sentence(action?.primary ?? [])).toBe('Zei takes 12 damage')
    expect(sentence(action?.primary ?? [])).not.toContain('strikes Zei')
  })

  it('explains timeout streaks, status duration, and mechanics in player language', () => {
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
          facts: [{ label: '2 consecutive timeouts', tone: 'warning' }],
        }),
        entry({
          battleVersion: 204,
          eventIndex: 3,
          eventType: 'pvp_lowered_guard_applied',
          message: 'Wayfarer gained Lowered Guard.',
          messageTemplate: '{target} gained Lowered Guard.',
          templateValues: {
            status: 'Lowered Guard',
            statusChange: 'STACKED',
            stacks: '2',
          },
          actorCombatantId: null,
          targetCombatantId: 'character:zei',
          actionId: null,
          actionLabel: null,
          kind: 'status',
          headline: 'Lowered Guard',
          tone: 'warning',
          facts: [
            { label: 'Lowered Guard', tone: 'warning' },
            { label: '×2 stacks', tone: 'neutral' },
            { label: '1 turn', tone: 'neutral' },
            { label: 'Takes 2.5× damage', tone: 'warning' },
          ],
        }),
        entry({
          battleVersion: 204,
          eventIndex: 2,
          eventType: 'status_applied',
          message: 'Wayfarer gained Lowered Guard for 1000 owner-turn starts.',
          messageTemplate: '{target} gained {status}.',
          templateValues: { status: 'Lowered Guard', statusChange: 'APPLIED' },
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
        entry({
          battleVersion: 204,
          eventIndex: 1,
          eventType: 'status_expired',
          message: 'Lowered Guard expired on Wayfarer.',
          messageTemplate: '{status} expired on {target}.',
          templateValues: { status: 'Lowered Guard' },
          actorCombatantId: null,
          targetCombatantId: 'character:zei',
          actionId: null,
          actionLabel: null,
          kind: 'status',
          headline: 'Lowered Guard',
          tone: 'neutral',
          facts: [],
        }),
      ],
      { combatantNames: names },
    )

    const actions = rounds[0]?.actions ?? []
    expect(sentence(actions[0]?.primary ?? [])).toBe("Zei's turn expires — action forfeited")
    expect(sentence(actions[0]?.secondary ?? [])).toBe(
      "↳ Zei's Lowered Guard stacks to ×2 · until next turn",
    )
    expect(actions[0]?.details.map((detail) => detail.label)).toEqual([
      'Takes 2.5× damage',
      '2 consecutive timeouts',
    ])
    expect(sentence(actions[1]?.primary ?? [])).toBe("Zei's Lowered Guard fades")
    expect(JSON.stringify(actions)).not.toContain('1000 turns')
    expect(JSON.stringify(actions)).not.toMatch(/\bmiss(?:es)?\b/iu)
  })

  it('renders status refreshes as lifecycle changes rather than duplicate applications', () => {
    const action = buildBattleLogPresentation(
      [
        entry({
          eventType: 'status_applied',
          messageTemplate: "{target}'s {status} refreshed.",
          templateValues: { status: 'Guarded', statusChange: 'REFRESHED' },
          actorCombatantId: null,
          targetCombatantId: 'character:zei',
          actionId: null,
          actionLabel: null,
          kind: 'defense',
          headline: 'Guarded',
          tone: 'benefit',
          facts: [
            { label: 'Guarded', tone: 'benefit' },
            { label: '2 turns', tone: 'neutral' },
          ],
        }),
      ],
      { combatantNames: names },
    )[0]?.actions[0]
    expect(sentence(action?.primary ?? [])).toBe("Zei's Guarded refreshes · 2 turns")
  })

  it('renders added status stacks with the authoritative total', () => {
    const action = buildBattleLogPresentation(
      [
        entry({
          eventType: 'status_applied',
          messageTemplate: "{target}'s {status} stacks to ×{stacks}.",
          templateValues: { status: 'Guarded', statusChange: 'STACKED', stacks: '2' },
          targetCombatantId: 'character:zei',
          tone: 'benefit',
          facts: [
            { label: 'Guarded', tone: 'benefit' },
            { label: '×2 stacks', tone: 'neutral' },
            { label: '2 turns', tone: 'neutral' },
          ],
        }),
      ],
      { combatantNames: names },
    )[0]?.actions[0]

    expect(sentence(action?.primary ?? [])).toBe("Zei's Guarded stacks to ×2 · 2 turns")
  })

  it('renders a miss as a sentence with clear hit-chance detail', () => {
    const action = buildBattleLogPresentation(
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
            { label: '61% hit chance', tone: 'neutral' },
          ],
        }),
      ],
      { combatantNames: names },
    )[0]?.actions[0]
    expect(sentence(action?.primary ?? [])).toBe('Zei strikes Storm — Miss')
    expect(action?.details.map((detail) => detail.label)).toEqual(['61% hit chance'])
  })

  it('uses authored short skill narration when valid and keeps authoritative outcome visible', () => {
    const skillNarrations: Record<string, SkillNarrationTemplate> = {
      'basic.attack.unarmed.basic': {
        hit: "{actor} drives a sweeping cut through {target}'s guard",
        miss: "{actor}'s sweeping cut slips past {target}",
      },
    }
    const hit = buildBattleLogPresentation(attackEntries(), {
      combatantNames: names,
      skillNarrations,
    })[0]?.actions[0]
    expect(sentence(hit?.primary ?? [])).toBe(
      "Zei drives a sweeping cut through Storm's guard — 18 damage",
    )

    const miss = buildBattleLogPresentation(
      [
        entry({
          eventType: 'stat_driven_attack_resolved',
          templateValues: { action: 'Basic Attack', outcome: 'MISSED' },
          targetCombatantId: 'character:storm',
          tone: 'warning',
          facts: [{ label: 'MISS', tone: 'warning' }],
        }),
      ],
      { combatantNames: names, skillNarrations },
    )[0]?.actions[0]
    expect(sentence(miss?.primary ?? [])).toBe("Zei's sweeping cut slips past Storm — Miss")
  })

  it('gives named skills a concise deterministic description when authored narration is absent', () => {
    const action = buildBattleLogPresentation(
      attackEntries({ actionId: 'skill.ember-lance', actionLabel: 'Ember Lance' }),
      { combatantNames: names },
    )[0]?.actions[0]

    expect(sentence(action?.primary ?? [])).toBe(
      'Zei sends Ember Lance blazing into Storm — 18 damage',
    )
    expect(action?.details.map((detail) => detail.label)).toEqual([
      '82 HP remaining',
      '74% hit chance',
    ])
  })

  it('keeps movement readable while leaving coordinates and cost in Details', () => {
    const action = buildBattleLogPresentation(
      [
        entry({
          eventType: 'combatant_moved',
          message: 'Wayfarer moved from 1, 1 to 2, 1 for 25 Movement.',
          messageTemplate: '{actor} moved from 1, 1 to 2, 1.',
          templateValues: {},
          actionId: null,
          actionLabel: null,
          kind: 'movement',
          headline: 'Move',
          facts: [
            { label: '1, 1 → 2, 1', tone: 'neutral' },
            { label: '25 Move spent', tone: 'neutral' },
          ],
        }),
      ],
      { combatantNames: names },
    )[0]?.actions[0]

    expect(sentence(action?.primary ?? [])).toBe('Zei moves')
    expect(action?.details.map((detail) => detail.label)).toEqual(['1, 1 → 2, 1', '25 Move spent'])
  })

  it('describes a defensive action once and keeps its status as the immediate consequence', () => {
    const action = buildBattleLogPresentation(
      [
        entry({
          eventIndex: 0,
          actionId: 'basic.guard',
          actionLabel: 'Guard',
          templateValues: { action: 'Guard' },
          kind: 'defense',
          headline: 'Guard',
        }),
        entry({
          eventIndex: 1,
          eventType: 'status_applied',
          message: 'Wayfarer gained Guarded.',
          messageTemplate: '{target} gained {status}.',
          templateValues: { status: 'Guarded', statusChange: 'APPLIED' },
          actorCombatantId: null,
          targetCombatantId: 'character:zei',
          actionId: null,
          actionLabel: null,
          kind: 'defense',
          headline: 'Guarded',
          tone: 'benefit',
          facts: [
            { label: 'Guarded', tone: 'benefit' },
            { label: '1 turn', tone: 'neutral' },
          ],
        }),
      ],
      { combatantNames: names },
    )[0]?.actions[0]

    expect(sentence(action?.primary ?? [])).toBe('Zei braces with Guard')
    expect(sentence(action?.secondary ?? [])).toBe('↳ Zei gains Guarded · 1 turn')
  })

  it('keeps a finishing action visible when battle completion shares its committed version', () => {
    const actions =
      buildBattleLogPresentation(
        [
          ...attackEntries(),
          entry({
            eventIndex: 3,
            eventType: 'battle_completed',
            message: 'Battle completed.',
            messageTemplate: 'Battle completed.',
            templateValues: {},
            actorCombatantId: null,
            targetCombatantId: null,
            actionId: null,
            actionLabel: null,
            kind: 'system',
            headline: 'Battle Complete',
            tone: 'benefit',
            facts: [{ label: 'Complete', tone: 'benefit' }],
          }),
        ],
        { combatantNames: names },
      )[0]?.actions ?? []

    expect(sentence(actions[0]?.primary ?? [])).toBe('Battle complete')
    expect(sentence(actions[1]?.primary ?? [])).toBe('Zei strikes Storm — 18 damage')
  })

  it('falls back safely when authored narration is malformed', () => {
    const action = buildBattleLogPresentation(attackEntries(), {
      combatantNames: names,
      skillNarrations: {
        'basic.attack.unarmed.basic': { hit: '{actor} reveals {secret_roll} to {target}' },
      },
    })[0]?.actions[0]
    expect(sentence(action?.primary ?? [])).toBe('Zei strikes Storm — 18 damage')
  })

  it('uses a neutral Battle fallback rather than a Recent bucket for genuinely roundless events', () => {
    const rounds = buildBattleLogPresentation([entry({ round: null, turnNumber: null })], {
      combatantNames: names,
    })
    expect(rounds[0]?.key).toBe('battle')
    expect(rounds[0]?.round).toBeNull()
    expect(rounds.some((round) => round.key === 'recent')).toBe(false)
  })
})
