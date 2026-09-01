import { describe, expect, it } from 'vitest'

import type { BattleLogEntry } from '@/server/battle/battle-log-service'

import { formatBattleLogForClipboard } from './battle-log-clipboard'

function entry(overrides: Partial<BattleLogEntry> = {}): BattleLogEntry {
  return {
    battleVersion: 1,
    eventIndex: 0,
    occurredAt: '2026-09-01T00:08:51.017Z',
    eventType: 'combatant_moved',
    message: 'Wayfarer moved from 2, 4 to 4, 5 for 4 Movement.',
    messageTemplate: '{actor} moved from 2, 4 to 4, 5.',
    templateValues: {},
    actorCombatantId: 'character:storm',
    targetCombatantId: null,
    actionId: null,
    actionLabel: null,
    round: 1,
    turnNumber: 1,
    kind: 'movement',
    headline: 'Move',
    tone: 'neutral',
    facts: [
      { label: '2, 4 → 4, 5', tone: 'neutral' },
      { label: '4 Move spent', tone: 'neutral' },
    ],
    ...overrides,
  }
}

describe('Battle Log clipboard transcript', () => {
  it('copies the readable battle transcript instead of raw server event diagnostics', () => {
    const copied = formatBattleLogForClipboard(
      [
        entry({ battleVersion: 2 }),
        entry({
          battleVersion: 3,
          message: 'Wayfarer moved from 4, 5 to 5, 5 for 1 Movement.',
          messageTemplate: '{actor} moved from 4, 5 to 5, 5.',
          facts: [
            { label: '4, 5 → 5, 5', tone: 'neutral' },
            { label: '1 Move spent', tone: 'neutral' },
          ],
        }),
        entry({
          battleVersion: 4,
          eventIndex: 1,
          eventType: 'stat_driven_attack_resolved',
          message: 'Recruit Basic Attack HIT (62% hit chance).',
          messageTemplate: '{actor} {action} {outcome}.',
          templateValues: { action: 'Basic Attack', outcome: 'HIT' },
          actorCombatantId: 'scenario:recruit',
          targetCombatantId: 'character:storm',
          actionId: 'basic.attack.unarmed.basic',
          actionLabel: 'Basic Attack',
          kind: 'offense',
          headline: 'Basic Attack',
          tone: 'damage',
          facts: [
            { label: 'HIT', tone: 'damage' },
            { label: '62% hit chance', tone: 'neutral' },
          ],
        }),
        entry({
          battleVersion: 4,
          eventIndex: 3,
          eventType: 'combat_action_used',
          message: 'Recruit used Basic Attack.',
          messageTemplate: '{actor} used {action}.',
          templateValues: { action: 'Basic Attack' },
          actorCombatantId: 'scenario:recruit',
          targetCombatantId: 'character:storm',
          actionId: 'basic.attack.unarmed.basic',
          actionLabel: 'Basic Attack',
          kind: 'offense',
          headline: 'Basic Attack',
          tone: 'neutral',
          facts: [],
        }),
        entry({
          battleVersion: 4,
          eventIndex: 4,
          eventType: 'damage_applied',
          message: 'Wayfarer took 8 damage and has 154 HP remaining.',
          messageTemplate: '{target} took {amount} damage.',
          templateValues: { amount: '8' },
          actorCombatantId: 'scenario:recruit',
          targetCombatantId: 'character:storm',
          actionId: 'basic.attack.unarmed.basic',
          actionLabel: 'Basic Attack',
          kind: 'offense',
          headline: 'Damage',
          tone: 'damage',
          facts: [
            { label: '8 DMG', tone: 'damage' },
            { label: '154 HP remaining', tone: 'neutral' },
          ],
        }),
      ],
      {
        playerName: 'Storm',
        combatantNames: {
          'character:storm': 'Storm',
          'scenario:recruit': 'Recruit',
        },
      },
    )

    expect(copied).toContain('Round 1')
    expect(copied).toContain('#1: Storm moves')
    expect(copied.match(/Storm moves/g)).toHaveLength(1)
    expect(copied).toContain('#2: Recruit strikes Storm')
    expect(copied).toContain('   - Storm takes 8 damage')
    expect(copied).not.toContain('2026-09-01T00:08:51.017Z')
    expect(copied).not.toMatch(/\bv\d+\.\d+\b/u)
    expect(copied).not.toContain('2, 4')
    expect(copied).not.toContain('62% hit chance')
    expect(copied).not.toContain('154 HP remaining')
  })
})
