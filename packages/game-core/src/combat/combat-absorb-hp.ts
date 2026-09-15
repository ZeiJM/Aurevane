import type {
  CombatContentCatalog,
  CombatEncounterState,
  CombatResolutionEvent,
  CombatResolutionTransition,
} from './actions'
import { validateCombatStatusDefinition } from './combat-authoring-validation'

const ABSORB_HP_BASIS_POINTS = 10_000
const ABSORB_HP_ACTION_ID = 'status.absorb-hp.current.v1'

/** Consume only the original command's committed events, never reactive output. */
export function applyCommittedAbsorbHp(
  state: CombatEncounterState,
  events: readonly CombatResolutionEvent[],
  content: CombatContentCatalog,
  command: { sourceCombatantId: string; actionId: string },
): CombatResolutionTransition {
  const battle = state.tactical.battle
  const source = battle.combatants.find((unit) => unit.id === command.sourceCombatantId)
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
    const target = battle.combatants.find((unit) => unit.id === event.targetCombatantId)
    if (!target || target.teamId === source.teamId || target.hp <= 0) continue

    const total = (damageByTarget.get(target.id) ?? 0) + event.amount
    if (!Number.isSafeInteger(total)) {
      throw new RangeError('Absorb HP committed damage must remain a safe integer.')
    }
    damageByTarget.set(target.id, total)
  }

  const recoveredHp = new Map<string, number>()
  const recoveryEvents: CombatResolutionEvent[] = []
  for (const [targetId, damage] of damageByTarget) {
    const target = battle.combatants.find((unit) => unit.id === targetId)!
    const basisPoints = activeAbsorbHpBasisPoints(state, content, targetId)
    if (basisPoints === 0 || target.hp >= target.maxHp) continue

    // Integer arithmetic keeps the percentage floor exact before the minimum-1 rule.
    const requested = Math.max(
      1,
      Number((BigInt(damage) * BigInt(basisPoints)) / BigInt(ABSORB_HP_BASIS_POINTS)),
    )
    const amount = Math.min(target.maxHp - target.hp, requested)
    const hpAfter = target.hp + amount
    recoveredHp.set(targetId, hpAfter)
    recoveryEvents.push({
      event: 'healing_applied',
      actionId: ABSORB_HP_ACTION_ID,
      sourceCombatantId: targetId,
      targetCombatantId: targetId,
      amount,
      hpBefore: target.hp,
      hpAfter,
    })
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
            const hp = recoveredHp.get(unit.id)
            return hp === undefined ? unit : { ...unit, hp }
          }),
        },
      },
    },
    // One bounded pass: newly emitted healing never feeds back into this input.
    events: [...events, ...recoveryEvents],
  }
}

function activeAbsorbHpBasisPoints(
  state: CombatEncounterState,
  content: CombatContentCatalog,
  targetId: string,
): number {
  const statuses = state.statusState.find((row) => row.combatantId === targetId)?.statuses ?? []
  let total = 0
  for (const instance of statuses) {
    if (instance.remainingOwnerTurnStarts <= 0 || instance.stacks <= 0) continue
    const definition = content.statuses.find(
      (status) => status.id === instance.statusId && status.version === instance.statusVersion,
    )
    if (definition?.absorbHpBasisPoints === undefined) continue
    validateCombatStatusDefinition(definition)
    total = Math.min(
      ABSORB_HP_BASIS_POINTS,
      total + definition.absorbHpBasisPoints * instance.stacks,
    )
  }
  return total
}
