import type {
  CombatEncounterState,
  CombatContentCatalog,
  CombatResolutionTransition,
} from './actions'
import { defeatCombatActionActor, removeGameplayTags } from './actions-legacy'
import { classifyFacingRelation } from './board'
import { absorbIndirectDamageWithBarrier } from './combat-barrier'
import { clearDefeatedRecovery } from './combat-recovery'
import { consumeCombatTrigger, createCombatTriggerGuard } from './combat-kernel-types'
import type { CombatNativeExecutionHooks } from './combat-native-mutations'
import {
  armedCombatReversalPayload,
  hasArmedCombatReversal,
  endCombatReversal,
  type CombatReversalEvent,
} from './combat-reversal'
/** A returned packet has a dedicated receipt: no Damage/Absorb/Vengeance/Endure/reactive credit. */
export function interceptCombatReversal(
  state: CombatEncounterState,
  input: {
    actorId: string
    recipientId: string
    actionId: string
    family?: 'physical' | 'mystic'
    wouldHpDamage: number
    content: CombatContentCatalog
    nativeHooks?: CombatNativeExecutionHooks
    reactionGuard?: Pick<CombatNativeExecutionHooks, 'getGuard' | 'setGuard'>
  },
): CombatResolutionTransition | undefined {
  const armed = (state.reversalState?.armed ?? []).find(
      (row) => row.ownerCombatantId === input.recipientId,
    ),
    payload = armed && armedCombatReversalPayload(state, armed)
  const attacker = state.tactical.battle.combatants.find((unit) => unit.id === input.actorId),
    defender = state.tactical.battle.combatants.find((unit) => unit.id === input.recipientId)
  const origin = state.tactical.placements.find((row) => row.combatantId === input.actorId),
    placement = state.tactical.placements.find((row) => row.combatantId === input.recipientId)
  if (
    !armed ||
    !payload ||
    !hasArmedCombatReversal(state, input.recipientId) ||
    !attacker ||
    !defender ||
    attacker.hp <= 0 ||
    defender.hp <= 0 ||
    attacker.teamId === defender.teamId ||
    input.wouldHpDamage <= 0 ||
    input.family !== payload.family ||
    !origin ||
    !placement ||
    (origin.position.x === placement.position.x && origin.position.y === placement.position.y) ||
    classifyFacingRelation(placement.position, placement.facing, origin.position) === 'rear'
  )
    return undefined
  const reactionGuard = input.nativeHooks ?? input.reactionGuard
  const guard =
    reactionGuard?.getGuard() ??
    createCombatTriggerGuard({
      triggerChainId: JSON.stringify([
        'reversal',
        state.tactical.battle.battleId,
        state.tactical.battle.turnNumber,
        input.actionId,
      ]),
    })
  const trigger = consumeCombatTrigger(guard, {
    instanceId: JSON.stringify(['reversal', armed.sourceInstanceId, armed.preparedTurnNumber]),
    depth: 1,
  })
  if (!trigger.accepted) return undefined
  reactionGuard?.setGuard(trigger.guard)
  const reflected = (BigInt(input.wouldHpDamage) * BigInt(payload.reflectionBasisPoints)) / 10000n
  const attackerCap =
      (BigInt(attacker.maxHp) * BigInt(payload.attackerMaxHpCapBasisPoints)) / 10000n,
    defenderCap = (BigInt(defender.maxHp) * BigInt(payload.defenderMaxHpCapBasisPoints)) / 10000n
  const requested = [reflected, attackerCap, defenderCap].reduce((a, b) => (a < b ? a : b))
  const ended = endCombatReversal(state, input.recipientId, 'triggered')
  const barrier = absorbIndirectDamageWithBarrier(
    ended.state,
    input.recipientId,
    input.actorId,
    'combat.reversal.return.v1',
    requested,
    { content: input.content },
  )
  let next = barrier.state
  const hpAfter = attacker.hp - barrier.remainingDamage
  const receipt: CombatReversalEvent = {
    event: 'reversal_triggered',
    actionId: armed.abilityId,
    combatantId: input.recipientId,
    attackerCombatantId: input.actorId,
    incomingActionId: input.actionId,
    preventedDamage: input.wouldHpDamage,
    returnedDamage: barrier.remainingDamage,
    ...(armed.sourceCommandVisibility
      ? { sourceCommandVisibility: armed.sourceCommandVisibility }
      : {}),
  }
  const defeated =
    hpAfter === 0 && next.tactical.battle.currentTurn?.combatantId === attacker.id
      ? defeatCombatActionActor(next, attacker.id, input.content, input.nativeHooks)
      : undefined
  next =
    defeated?.state ??
    clearDefeatedRecovery({
      ...next,
      tactical: {
        ...next.tactical,
        battle: {
          ...next.tactical.battle,
          combatants: next.tactical.battle.combatants.map((unit) =>
            unit.id === attacker.id ? { ...unit, hp: hpAfter } : unit,
          ),
        },
      },
    })
  const visible =
    barrier.remainingDamage > 0
      ? removeGameplayTags(
          next,
          input.recipientId,
          input.recipientId,
          'combat.reversal.return.v1',
          ['Invisible'],
          input.content,
        )
      : { state: next, events: [] }
  return {
    state: visible.state,
    events: [
      ...ended.events,
      ...barrier.events,
      receipt,
      ...visible.events,
      ...(defeated?.events ?? []),
    ],
  }
}
