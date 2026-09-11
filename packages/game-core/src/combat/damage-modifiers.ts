import type { CombatContentCatalog, CombatEncounterState } from './actions'
import { classifyFacingRelation } from './board'

export type DamageCondition =
  | { kind: 'always' }
  | { kind: 'opponent-status'; statusId: string }
  | { kind: 'owner-hp-at-most'; basisPoints: number }
  | { kind: 'distance-at-least'; tiles: number }
  | { kind: 'opponent-is-source'; matches: boolean }
  | { kind: 'attacker-facing'; relation: 'front' | 'side' | 'rear' }

export interface CombatDamageModifier {
  direction: 'outgoing' | 'incoming'
  multiplierBasisPoints: number
  condition: DamageCondition
}

/** New modifiers share a bounded budget; historical Guarded/Exposed stacks remain separate. */
export const CONDITIONAL_DAMAGE_MINIMUM = 5_000
export const CONDITIONAL_DAMAGE_MAXIMUM = 20_000

export function conditionalDamageMultiplier(
  state: CombatEncounterState,
  attackerId: string,
  recipientId: string,
  content: CombatContentCatalog,
): number {
  let numerator = 10_000n
  let denominator = 1n
  for (const [ownerId, opponentId, direction] of [
    [attackerId, recipientId, 'outgoing'],
    [recipientId, attackerId, 'incoming'],
  ] as const) {
    const statuses = state.statusState.find((row) => row.combatantId === ownerId)?.statuses ?? []
    for (const status of statuses) {
      const definition = content.statuses.find(
        (candidate) =>
          candidate.id === status.statusId && candidate.version === status.statusVersion,
      )
      for (const modifier of definition?.damageModifiers ?? []) {
        if (modifier.direction !== direction) continue
        if (
          !matchesCondition(
            state,
            ownerId,
            opponentId,
            attackerId,
            recipientId,
            status.sourceCombatantId,
            modifier.condition,
          )
        )
          continue
        // Each new modifier is applied once per status, independently of legacy stack counts.
        numerator *= BigInt(modifier.multiplierBasisPoints)
        denominator *= 10_000n
      }
    }
  }
  const result = numerator / denominator
  return Number(
    result < BigInt(CONDITIONAL_DAMAGE_MINIMUM)
      ? BigInt(CONDITIONAL_DAMAGE_MINIMUM)
      : result > BigInt(CONDITIONAL_DAMAGE_MAXIMUM)
        ? BigInt(CONDITIONAL_DAMAGE_MAXIMUM)
        : result,
  )
}

function matchesCondition(
  state: CombatEncounterState,
  ownerId: string,
  opponentId: string,
  attackerId: string,
  recipientId: string,
  sourceId: string,
  condition: DamageCondition,
): boolean {
  switch (condition.kind) {
    case 'always':
      return true
    case 'opponent-status':
      return state.statusState.some(
        (row) =>
          row.combatantId === opponentId &&
          row.statuses.some((status) => status.statusId === condition.statusId),
      )
    case 'opponent-is-source':
      return (opponentId === sourceId) === condition.matches
    case 'owner-hp-at-most': {
      const owner = state.tactical.battle.combatants.find((combatant) => combatant.id === ownerId)
      return (
        !!owner && BigInt(owner.hp) * 10_000n <= BigInt(owner.maxHp) * BigInt(condition.basisPoints)
      )
    }
    case 'distance-at-least': {
      const owner = state.tactical.placements.find((placement) => placement.combatantId === ownerId)
      const opponent = state.tactical.placements.find(
        (placement) => placement.combatantId === opponentId,
      )
      return (
        !!owner &&
        !!opponent &&
        Math.abs(owner.position.x - opponent.position.x) +
          Math.abs(owner.position.y - opponent.position.y) >=
          condition.tiles
      )
    }
    case 'attacker-facing': {
      const attacker = state.tactical.placements.find(
        (placement) => placement.combatantId === attackerId,
      )
      const recipient = state.tactical.placements.find(
        (placement) => placement.combatantId === recipientId,
      )
      return (
        !!attacker &&
        !!recipient &&
        classifyFacingRelation(recipient.position, recipient.facing, attacker.position) ===
          condition.relation
      )
    }
  }
}

export function validateDamageModifiers(
  modifiers: readonly CombatDamageModifier[] | undefined,
): void {
  if (modifiers === undefined) return
  if (!Array.isArray(modifiers) || modifiers.length > 2)
    throw new TypeError('A status supports at most two damage modifiers.')
  for (const modifier of modifiers) {
    if (
      !['outgoing', 'incoming'].includes(modifier.direction) ||
      !Number.isSafeInteger(modifier.multiplierBasisPoints) ||
      modifier.multiplierBasisPoints < 5_000 ||
      modifier.multiplierBasisPoints > 15_000
    )
      throw new TypeError('Invalid bounded damage modifier.')
    const condition = modifier.condition
    if (
      !condition ||
      ![
        'always',
        'opponent-status',
        'owner-hp-at-most',
        'distance-at-least',
        'opponent-is-source',
        'attacker-facing',
      ].includes(condition.kind)
    )
      throw new TypeError('Unknown damage condition.')
    if (
      condition.kind === 'opponent-status' &&
      !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(condition.statusId)
    )
      throw new TypeError('Invalid opponent status.')
    if (
      condition.kind === 'owner-hp-at-most' &&
      (!Number.isSafeInteger(condition.basisPoints) ||
        condition.basisPoints < 0 ||
        condition.basisPoints > 10_000)
    )
      throw new TypeError('Invalid HP threshold.')
    if (
      condition.kind === 'distance-at-least' &&
      (!Number.isSafeInteger(condition.tiles) || condition.tiles < 1 || condition.tiles > 32)
    )
      throw new TypeError('Invalid distance threshold.')
    if (condition.kind === 'opponent-is-source' && typeof condition.matches !== 'boolean')
      throw new TypeError('Invalid source condition.')
    if (
      condition.kind === 'attacker-facing' &&
      !['front', 'side', 'rear'].includes(condition.relation)
    )
      throw new TypeError('Invalid facing condition.')
  }
}
