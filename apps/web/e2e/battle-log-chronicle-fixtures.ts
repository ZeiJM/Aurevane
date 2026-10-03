import type { BattleLogEntry } from '../src/server/battle/battle-log-service'

/** Viewer-safe history fixture; actual battle state and commits still come from the server. */
export function recordedChronicleAction(action: number, round = 1): BattleLogEntry[] {
  const base: BattleLogEntry = {
    battleVersion: action,
    eventIndex: 0,
    occurredAt: '2026-10-03T09:00:00.000Z',
    eventType: 'combat_action_used',
    message: `Recorded action ${action}`,
    messageTemplate: '{actor} uses {action}.',
    templateValues: { action: `Recorded action ${action}` },
    actorCombatantId: 'character:fixture',
    targetCombatantId: 'recruit:fixture',
    actionId: 'basic.attack.unarmed.basic',
    actionLabel: `Recorded action ${action}`,
    round,
    turnNumber: round,
    kind: 'offense',
    headline: `Recorded action ${action}`,
    tone: 'neutral',
    facts: [],
    actionContext: {
      skillId: 'basic.attack.unarmed.basic',
      contentVersion: 1,
      name: `Recorded action ${action}`,
      description: 'An immutable fixture description.',
      flavor: '{actor} finds an opening in {target}’s guard.',
    },
  }
  return [
    base,
    {
      ...base,
      eventIndex: 1,
      eventType: 'damage_applied',
      message: `Target takes ${action} damage.`,
      messageTemplate: '{target} takes {amount} damage.',
      templateValues: { amount: String(action) },
      tone: 'damage',
      actionContext: undefined,
    },
  ]
}
