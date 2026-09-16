import type {
  CombatContentCatalog,
  CombatEncounterState,
  CombatResolutionEvent,
  CombatResolutionTransition,
} from './actions'
import { validateCombatStatusDefinition } from './combat-authoring-validation'

const ABSORB_BASIS_POINTS = 10_000
const ABSORB_HP_ACTION_ID = 'status.absorb-hp.current.v1'
const ABSORB_MP_ACTION_ID = 'status.absorb-mp.current.v1'

/** Consume only the original command's committed events, never reactive output. */
export function applyCommittedAbsorbRecovery(
  state: CombatEncounterState,
  events: readonly CombatResolutionEvent[],
  content: CombatContentCatalog,
  command: { sourceCombatantId: string; actionId: string },
): CombatResolutionTransition {
  const battle = state.tactical.battle
  const combatants = new Map(battle.combatants.map((unit) => [unit.id, unit]))
  const source = combatants.get(command.sourceCombatantId)
  if (!source) return { state, events }

  const damageByTarget = new Map<string, number>()
  for (const event of events) {
    if (
      event.event !== 'damage_applied' ||
      event.amount <= 0 ||
      event.sourceCombatantId !== source.id ||
      event.actionId !== command.actionId
    ) {
      continue
    }
    const target = combatants.get(event.targetCombatantId)
    if (!target || target.teamId === source.teamId || target.hp <= 0) continue

    const total = (damageByTarget.get(target.id) ?? 0) + event.amount
    if (!Number.isSafeInteger(total)) {
      throw new RangeError('Absorb committed damage must remain a safe integer.')
    }
    damageByTarget.set(target.id, total)
  }

  const recoveredPools = new Map<string, { hp: number; mp: number }>()
  const recoveryEvents: CombatResolutionEvent[] = []
  for (const [targetId, damage] of damageByTarget) {
    const target = combatants.get(targetId)
    if (!target) continue
    const rates = activeAbsorbBasisPoints(state, content, targetId)
    // Both resources use original HP damage, never the net loss after healing.
    const hpRecovery = recoveryAmount(damage, rates.hp, target.maxHp - target.hp)
    const mpRecovery = recoveryAmount(damage, rates.mp, target.maxMp - target.mp)
    if (hpRecovery === 0 && mpRecovery === 0) continue

    const hpAfter = target.hp + hpRecovery
    const mpAfter = target.mp + mpRecovery
    recoveredPools.set(targetId, { hp: hpAfter, mp: mpAfter })
    if (hpRecovery > 0) {
      recoveryEvents.push({
        event: 'healing_applied',
        actionId: ABSORB_HP_ACTION_ID,
        sourceCombatantId: targetId,
        targetCombatantId: targetId,
        amount: hpRecovery,
        hpBefore: target.hp,
        hpAfter,
      })
    }
    if (mpRecovery > 0) {
      recoveryEvents.push({
        event: 'resource_changed',
        actionId: ABSORB_MP_ACTION_ID,
        sourceCombatantId: targetId,
        targetCombatantId: targetId,
        resource: 'mp',
        delta: mpRecovery,
        before: target.mp,
        after: mpAfter,
      })
    }
  }

  if (recoveryEvents.length === 0) return { state, events }

  return {
    state: {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...battle,
          combatants: battle.combatants.map((unit) => {
            const pools = recoveredPools.get(unit.id)
            return pools === undefined ? unit : { ...unit, ...pools }
          }),
        },
      },
    },
    // One bounded pass: emitted healing/restoration never feeds back into this input.
    events: [...events, ...recoveryEvents],
  }
}

function recoveryAmount(damage: number, basisPoints: number, capacity: number): number {
  if (basisPoints === 0 || capacity <= 0) return 0
  // Integer arithmetic keeps the percentage floor exact before the minimum-1 rule.
  const requested = Math.max(
    1,
    Number((BigInt(damage) * BigInt(basisPoints)) / BigInt(ABSORB_BASIS_POINTS)),
  )
  return Math.min(capacity, requested)
}

function activeAbsorbBasisPoints(
  state: CombatEncounterState,
  content: CombatContentCatalog,
  targetId: string,
): { hp: number; mp: number } {
  const statuses = state.statusState.find((row) => row.combatantId === targetId)?.statuses ?? []
  let hp = 0
  let mp = 0
  for (const instance of statuses) {
    if (instance.remainingOwnerTurnStarts <= 0 || instance.stacks <= 0) continue
    const definition = content.statuses.find(
      (status) => status.id === instance.statusId && status.version === instance.statusVersion,
    )
    if (
      !definition ||
      (definition.absorbHpBasisPoints === undefined && definition.absorbMpBasisPoints === undefined)
    )
      continue
    validateCombatStatusDefinition(definition)
    hp = Math.min(ABSORB_BASIS_POINTS, hp + (definition.absorbHpBasisPoints ?? 0) * instance.stacks)
    mp = Math.min(ABSORB_BASIS_POINTS, mp + (definition.absorbMpBasisPoints ?? 0) * instance.stacks)
  }
  return { hp, mp }
}
