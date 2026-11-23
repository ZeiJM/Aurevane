import {
  observeCombatNativeMutation,
  type CombatNativeExecutionHooks,
} from './combat-native-mutations'
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
import { absorbIndirectDamageWithBarrier, captureDamageOverkill } from './combat-barrier'
import { capSummonDamage } from './combat-summon-potency'

const REFLECT_ACTION_ID = 'status.reflect.current.v1'
const REFLECT_BASIS_POINTS = 10_000

/** Barrier receipts precede their matching damage packet. Pair them once, retaining
 * that packet's captured family/rate; orphan absorption and overkill are not damage. */
function reflectDamageReceipts(
  state: CombatEncounterState,
  events: readonly CombatResolutionEvent[],
) {
  const absorbed = new Map<string, bigint>()
  const receipts: {
    receipt: Extract<CombatResolutionEvent, { event: 'damage_applied' }>
    basis: bigint
  }[] = []
  for (const event of events) {
    if (event.event !== 'damage_applied' && event.event !== 'barrier_absorbed') continue
    const key = JSON.stringify([event.sourceCombatantId, event.actionId, event.targetCombatantId])
    if (event.event === 'barrier_absorbed') {
      if (state.reflectBarrierPolicyVersion === 1 && event.amount > 0)
        absorbed.set(key, (absorbed.get(key) ?? 0n) + BigInt(event.amount))
    } else {
      receipts.push({ receipt: event, basis: BigInt(event.amount) + (absorbed.get(key) ?? 0n) })
      absorbed.delete(key)
    }
  }
  return receipts
}

/** One bounded pass over original damage receipts. Returns additional events only. */
export function applyCommittedReflect(
  state: CombatEncounterState,
  committedEvents: readonly CombatResolutionEvent[],
  content: CombatContentCatalog,
  command: CommittedCombatCommand,
  guard?: CombatTriggerGuard,
  allowOutOfTurnSource = false,
  nativeHooks?: CombatNativeExecutionHooks,
  counterOnly = false,
  allowCompletedResolution = false,
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
    (battle.lifecycle !== 'active' &&
      !(allowCompletedResolution && battle.lifecycle === 'completed')) ||
    !attacker ||
    attacker.hp <= 0 ||
    (!allowOutOfTurnSource && battle.currentTurn?.combatantId !== attacker.id)
  ) {
    return { state, events: [], triggerGuard }
  }
  const receipts = reflectDamageReceipts(state, committedEvents)
  const damageByTarget =
    state.reflectBarrierPolicyVersion === 1
      ? new Map<string, bigint>()
      : new Map(
          [...collectCommittedHostileCommandDamage(state, committedEvents, command)].map(
            ([id, amount]) => [id, BigInt(amount)],
          ),
        )
  if (state.reflectBarrierPolicyVersion === 1) {
    for (const { receipt, basis } of receipts) {
      const target = battle.combatants.find((unit) => unit.id === receipt.targetCombatantId)
      if (
        basis <= 0n ||
        receipt.sourceCombatantId !== attacker.id ||
        receipt.actionId !== command.actionId ||
        !target ||
        target.teamId === attacker.teamId
      )
        continue
      damageByTarget.set(target.id, (damageByTarget.get(target.id) ?? 0n) + basis)
    }
  }
  const ordered = [...damageByTarget].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  let nextState = state
  const events: CombatResolutionEvent[] = []
  for (const [defenderId, damage] of ordered) {
    const currentAttacker = nextState.tactical.battle.combatants.find(
      (unit) => unit.id === attacker.id,
    )
    if (!currentAttacker || currentAttacker.hp <= 0) break
    const rate = counterOnly ? 0 : activeReflectBasisPoints(state, content, defenderId)
    // Reflect floors once per defender, with no Absorb-specific minimum-1 rule.
    const counterDamage = receipts.reduce((total, { receipt: event, basis }) => {
      if (
        event.event !== 'damage_applied' ||
        basis <= 0n ||
        event.targetCombatantId !== defenderId ||
        event.sourceCombatantId !== attacker.id ||
        event.actionId !== command.actionId ||
        event.actionId === REFLECT_ACTION_ID
      )
        return total
      return total + basis * BigInt(event.counterReturnBasisPoints ?? '0')
    }, 0n)
    const requested = (BigInt(damage) * BigInt(rate) + counterDamage) / BigInt(REFLECT_BASIS_POINTS)
    const amount = Number(
      requested < BigInt(currentAttacker.hp) ? requested : BigInt(currentAttacker.hp),
    )
    if (amount === 0) continue
    const attempted = consumeCombatTrigger(triggerGuard, {
      instanceId: `reflect:${JSON.stringify([triggerGuard.triggerChainId, command.actionId, attacker.id, defenderId])}`,
      depth: 1,
    })
    if (!attempted.accepted) continue
    triggerGuard = attempted.guard
    nativeHooks?.setGuard(triggerGuard)
    const beforeDamage = nextState
    const barrier = absorbIndirectDamageWithBarrier(
      nextState,
      defenderId,
      attacker.id,
      REFLECT_ACTION_ID,
      nextState.modularSkillPolicyVersion === 1 ? requested : amount,
      { content },
    )
    nextState = barrier.state
    const hpAfter = currentAttacker.hp - barrier.remainingDamage
    // Legacy settlement caps before Barrier. Recover only its display value from the
    // same immutable budget, leaving the historical HP-loss calculation untouched.
    const displayDamage =
      nextState.modularSkillPolicyVersion === 1
        ? barrier.damageBeforeHpLimit
        : capSummonDamage(beforeDamage, defenderId, attacker.id, requested, content).amount
    const damageReceipt = {
      event: 'damage_applied' as const,
      actionId: REFLECT_ACTION_ID,
      sourceCombatantId: defenderId,
      targetCombatantId: attacker.id,
      amount: currentAttacker.hp - hpAfter,
      ...captureDamageOverkill(displayDamage, currentAttacker.hp - hpAfter),
      hpBefore: currentAttacker.hp,
      hpAfter,
    }
    events.push(...barrier.events, damageReceipt)
    // Run encounter upkeep as well as selecting the next living combatant.
    const defeated =
      hpAfter === 0 && nextState.tactical.battle.currentTurn?.combatantId === attacker.id
        ? defeatCombatActionActor(nextState, attacker.id, content, nativeHooks, damageReceipt)
        : null
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
    if (!defeated)
      nextState = observeCombatNativeMutation(
        nativeHooks,
        beforeDamage,
        { state: nextState, events: [...barrier.events, damageReceipt] },
        {
          actionId: REFLECT_ACTION_ID,
          triggeringCombatantId: defenderId,
          affectedCombatantIds: [attacker.id],
        },
      ).state
    if (nativeHooks) triggerGuard = nativeHooks.getGuard()
    const revealed = observeCombatNativeMutation(
      nativeHooks,
      nextState,
      removeGameplayTags(
        nextState,
        defenderId,
        attacker.id,
        REFLECT_ACTION_ID,
        ['Invisible'],
        content,
      ),
      {
        actionId: REFLECT_ACTION_ID,
        triggeringCombatantId: defenderId,
        affectedCombatantIds: [attacker.id],
      },
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
  let rate = 0n
  for (const instance of statuses) {
    if (instance.remainingOwnerTurnStarts <= 0 || instance.stacks <= 0) continue
    const definition = content.statuses.find(
      (status) => status.id === instance.statusId && status.version === instance.statusVersion,
    )
    if (definition?.reflectBasisPoints === undefined) continue
    validateCombatStatusDefinition(definition)
    rate += BigInt(definition.reflectBasisPoints) * BigInt(instance.stacks)
  }
  if (state.effectStackingPolicyVersion === 1) {
    if (rate > BigInt(Number.MAX_SAFE_INTEGER))
      throw new RangeError('Combined Reflect rate exceeds the safe integer range.')
    return Number(rate)
  }
  return Number(rate < BigInt(REFLECT_BASIS_POINTS) ? rate : BigInt(REFLECT_BASIS_POINTS))
}

/** Sourced periodic packets share Counter settlement without enabling historical Reflect on DoTs. */
export function applyPeriodicCounterReturns(
  state: CombatEncounterState,
  receipts: readonly CombatResolutionEvent[],
  content: CombatContentCatalog,
  nativeHooks?: CombatNativeExecutionHooks,
  allowCompletedResolution = false,
): CombatResolutionTransition {
  let nextState = state
  const events: CombatResolutionEvent[] = []
  const commands = new Map<string, CommittedCombatCommand>()
  for (const { receipt: event, basis } of reflectDamageReceipts(state, receipts)) {
    if (!event.counterReturnBasisPoints || basis <= 0n) continue
    const command = { sourceCombatantId: event.sourceCombatantId, actionId: event.actionId }
    commands.set(JSON.stringify(command), command)
  }
  for (const command of commands.values()) {
    const returned = applyCommittedReflect(
      nextState,
      receipts,
      content,
      command,
      nativeHooks?.getGuard(),
      true,
      nativeHooks,
      true,
      allowCompletedResolution,
    )
    nextState = returned.state
    nativeHooks?.setGuard(returned.triggerGuard)
    events.push(...returned.events)
  }
  return { state: nextState, events }
}
