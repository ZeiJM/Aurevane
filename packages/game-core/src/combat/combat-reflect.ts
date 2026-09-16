import type {
  CombatContentCatalog,
  CombatEncounterState,
  CombatResolutionEvent,
  CombatResolutionTransition,
} from './actions'
import { defeatCombatActionActor, removeGameplayTags } from './actions-legacy'
import { createTacticalBattleState } from './board'
import { validateCombatStatusDefinition } from './combat-authoring-validation'
import {
  collectCommittedHostileCommandDamage,
  type CommittedCombatCommand,
} from './combat-committed-damage'
import {
  consumeCombatTrigger,
  createCombatTriggerGuard,
  type CombatTriggerGuard,
} from './combat-kernel-types'
import { clearDefeatedRecovery } from './combat-recovery'

const REFLECT_ACTION_ID = 'status.reflect.current.v1'
const REFLECT_BASIS_POINTS = 10_000

/** One bounded pass over original damage receipts. Returns additional events only. */
export function applyCommittedReflect(
  state: CombatEncounterState,
  committedEvents: readonly CombatResolutionEvent[],
  content: CombatContentCatalog,
  command: CommittedCombatCommand,
  guard?: CombatTriggerGuard,
): CombatResolutionTransition & { triggerGuard: CombatTriggerGuard } {
  const battle = state.tactical.battle
  let triggerGuard =
    guard ??
    createCombatTriggerGuard({
      triggerChainId: JSON.stringify([
        'reflect',
        battle.battleId,
        battle.round,
        battle.turnNumber,
        command.sourceCombatantId,
        command.actionId,
      ]),
    })
  const attacker = battle.combatants.find((unit) => unit.id === command.sourceCombatantId)
  if (
    battle.lifecycle !== 'active' ||
    !attacker ||
    attacker.hp <= 0 ||
    battle.currentTurn?.combatantId !== attacker.id
  ) {
    return { state, events: [], triggerGuard }
  }
  const damageByTarget = collectCommittedHostileCommandDamage(state, committedEvents, command)
  const ordered = [...damageByTarget].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  let nextState = state
  const events: CombatResolutionEvent[] = []
  for (const [defenderId, damage] of ordered) {
    const currentAttacker = nextState.tactical.battle.combatants.find(
      (unit) => unit.id === attacker.id,
    )
    if (!currentAttacker || currentAttacker.hp <= 0) break
    const rate = activeReflectBasisPoints(state, content, defenderId)
    // Reflect floors once per defender, with no Absorb-specific minimum-1 rule.
    const requested = Number((BigInt(damage) * BigInt(rate)) / BigInt(REFLECT_BASIS_POINTS))
    const amount = Math.min(currentAttacker.hp, requested)
    if (amount === 0) continue
    const attempted = consumeCombatTrigger(triggerGuard, {
      instanceId: `reflect:${JSON.stringify([triggerGuard.triggerChainId, command.actionId, attacker.id, defenderId])}`,
      depth: 1,
    })
    if (!attempted.accepted) continue
    triggerGuard = attempted.guard
    const hpAfter = currentAttacker.hp - amount
    events.push({
      event: 'damage_applied',
      actionId: REFLECT_ACTION_ID,
      sourceCombatantId: defenderId,
      targetCombatantId: attacker.id,
      amount,
      hpBefore: currentAttacker.hp,
      hpAfter,
    })
    // Run encounter upkeep as well as selecting the next living combatant.
    const defeated = hpAfter === 0 ? defeatCombatActionActor(nextState, attacker.id, content) : null
    nextState =
      defeated?.state ??
      clearDefeatedRecovery({
        ...nextState,
        tactical: createTacticalBattleState({
          ...nextState.tactical,
          battle: {
            ...nextState.tactical.battle,
            combatants: nextState.tactical.battle.combatants.map((unit) =>
              unit.id === attacker.id ? { ...unit, hp: hpAfter } : unit,
            ),
          },
        }),
      })
    const revealed = removeGameplayTags(
      nextState,
      defenderId,
      attacker.id,
      REFLECT_ACTION_ID,
      ['Invisible'],
      content,
    )
    nextState = revealed.state
    events.push(...revealed.events)
    if (defeated) events.push(...defeated.events)
  }
  return { state: nextState, events, triggerGuard }
}

function activeReflectBasisPoints(
  state: CombatEncounterState,
  content: CombatContentCatalog,
  defenderId: string,
): number {
  const statuses = state.statusState.find((row) => row.combatantId === defenderId)?.statuses ?? []
  let rate = 0
  for (const instance of statuses) {
    if (instance.remainingOwnerTurnStarts <= 0 || instance.stacks <= 0) continue
    const definition = content.statuses.find(
      (status) => status.id === instance.statusId && status.version === instance.statusVersion,
    )
    if (definition?.reflectBasisPoints === undefined) continue
    validateCombatStatusDefinition(definition)
    rate = Math.min(REFLECT_BASIS_POINTS, rate + definition.reflectBasisPoints * instance.stacks)
  }
  return rate
}
