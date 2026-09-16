import type { CombatEncounterState, CombatResolutionEvent } from './actions'

export interface CommittedCombatCommand {
  sourceCombatantId: string
  actionId: string
}

/** Only original command receipts qualify; callers must not feed reactive output back in. */
export function collectCommittedHostileCommandDamage(
  state: CombatEncounterState,
  events: readonly CombatResolutionEvent[],
  command: CommittedCombatCommand,
): ReadonlyMap<string, number> {
  const combatants = new Map(state.tactical.battle.combatants.map((unit) => [unit.id, unit]))
  const source = combatants.get(command.sourceCombatantId)
  const damageByTarget = new Map<string, number>()
  if (!source) return damageByTarget
  for (const event of events) {
    if (
      event.event !== 'damage_applied' ||
      event.amount <= 0 ||
      event.sourceCombatantId !== source.id ||
      event.actionId !== command.actionId
    )
      continue
    const target = combatants.get(event.targetCombatantId)
    if (!target || target.teamId === source.teamId) continue
    const total = (damageByTarget.get(target.id) ?? 0) + event.amount
    if (!Number.isSafeInteger(total)) {
      throw new RangeError('Committed hostile damage must remain a safe integer.')
    }
    damageByTarget.set(target.id, total)
  }
  return damageByTarget
}
