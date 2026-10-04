import { combatStatusApplications } from './combat-status-applications'
import { hasGameplayTag, validateGameplayTag, type GameplayTag } from './gameplay-tags'
import { hasCurrentBleed, hasCurrentBurn, hasCurrentPoison } from './combat-dots'
import type { CombatContentCatalog, CombatEncounterState } from './actions'
import { classifyFacingRelation } from './board'

export type DamageCondition =
  | { kind: 'always' }
  | { kind: 'opponent-tag'; tag: GameplayTag }
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

/** Historical snapshots retain their combined modifier budget. */
export const CONDITIONAL_DAMAGE_MINIMUM = 5_000
export const CONDITIONAL_DAMAGE_MAXIMUM = 20_000

export function conditionalDamageMultiplier(
  state: CombatEncounterState,
  attackerId: string,
  recipientId: string,
  content: CombatContentCatalog,
  elementalMultiplier = 10_000,
  options: { ignoreIncomingMitigation?: boolean } = {},
): number {
  let numerator = BigInt(elementalMultiplier)
  const inspiredStatuses =
    state.statusState
      .find((row) => row.combatantId === attackerId)
      ?.statuses.filter((status) => {
        const definition = content.statuses.find(
          (candidate) =>
            candidate.id === status.statusId && candidate.version === status.statusVersion,
        )
        return definition?.gameplayTags?.includes('Inspired') === true
      }) ?? []
  for (const inspired of state.effectStackingPolicyVersion === 1
    ? inspiredStatuses
    : inspiredStatuses.slice(0, 1)) {
    for (const application of state.effectStackingPolicyVersion === 1
      ? combatStatusApplications(inspired)
      : [{ ...inspired, stacks: 1 }]) {
      const multiplier = 10_000 + (application.potencyBasisPoints ?? 1_000)
      for (let index = 0; index < application.stacks; index += 1) {
        const next = (numerator * BigInt(multiplier)) / 10_000n
        if (next > BigInt(Number.MAX_SAFE_INTEGER))
          throw new RangeError('Inspired effect total exceeds the safe integer range.')
        if (next === numerator) break
        numerator = next
      }
    }
  }
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
      for (const application of state.effectStackingPolicyVersion === 1
        ? combatStatusApplications(status)
        : [{ ...status, stacks: 1 }]) {
        for (const modifier of definition?.damageModifiers ?? []) {
          if (modifier.direction !== direction) continue
          if (
            direction === 'incoming' &&
            options.ignoreIncomingMitigation === true &&
            modifier.multiplierBasisPoints < 10_000
          )
            continue
          if (
            !matchesCondition(
              state,
              ownerId,
              opponentId,
              attackerId,
              recipientId,
              application.sourceCombatantId,
              modifier.condition,
              content,
            )
          )
            continue
          // Current encounters preserve every application's magnitude; legacy rows apply once.
          const multiplier =
            application.potencyBasisPoints === undefined ||
            modifier.multiplierBasisPoints === 10_000
              ? modifier.multiplierBasisPoints
              : modifier.multiplierBasisPoints < 10_000
                ? Math.max(0, 10_000 - application.potencyBasisPoints)
                : 10_000 + application.potencyBasisPoints
          ;[numerator, denominator] = multiplyRepeatedRatio(
            numerator,
            denominator,
            multiplier,
            application.stacks,
          )
        }
      }
    }
  }
  const result = numerator / denominator
  if (state.effectStackingPolicyVersion === 1) {
    if (result > BigInt(Number.MAX_SAFE_INTEGER))
      throw new RangeError('Combined damage multiplier exceeds the safe integer range.')
    return Number(result)
  }
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
  content: CombatContentCatalog,
): boolean {
  switch (condition.kind) {
    case 'always':
      return true
    case 'opponent-tag':
      return hasGameplayTag(state, opponentId, condition.tag, content)
    case 'opponent-status':
      if (
        (condition.statusId === 'burn' && hasCurrentBurn(state, opponentId)) ||
        (condition.statusId === 'poison' && hasCurrentPoison(state, opponentId)) ||
        (condition.statusId === 'bleed' && hasCurrentBleed(state, opponentId))
      )
        return true
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
        'opponent-tag',
        'owner-hp-at-most',
        'distance-at-least',
        'opponent-is-source',
        'attacker-facing',
      ].includes(condition.kind)
    )
      throw new TypeError('Unknown damage condition.')
    if (condition.kind === 'opponent-tag') validateGameplayTag(condition.tag)
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

// Bound exact-arithmetic work, not gameplay applications. Neutral factors remain O(1)
// even for the largest valid count; unsupported numeric precision fails before a long loop.
function multiplyRepeatedRatio(
  numerator: bigint,
  denominator: bigint,
  multiplier: number,
  count: number,
): [bigint, bigint] {
  if (multiplier === 10_000 || numerator === 0n) return [numerator, denominator]
  const gcd = (a: bigint, b: bigint): bigint => {
    while (b !== 0n) [a, b] = [b, a % b]
    return a
  }
  const product = (a: bigint, b: bigint): bigint => {
    const result = a * b
    if (result.toString(2).length > 65_536)
      throw new RangeError('Combined effect arithmetic exceeds exact calculation capacity.')
    return result
  }
  const multiply = (left: [bigint, bigint], right: [bigint, bigint]): [bigint, bigint] => {
    const crossA = gcd(left[0], right[1])
    const crossB = gcd(right[0], left[1])
    return [
      product(left[0] / crossA, right[0] / crossB),
      product(left[1] / crossB, right[1] / crossA),
    ]
  }
  const divisor = gcd(BigInt(multiplier), 10_000n)
  let factor: [bigint, bigint] = [BigInt(multiplier) / divisor, 10_000n / divisor]
  let result: [bigint, bigint] = [numerator, denominator]
  for (let remaining = count; remaining > 0; remaining = Math.floor(remaining / 2)) {
    if (remaining % 2 === 1) result = multiply(result, factor)
    if (remaining > 1) factor = multiply(factor, factor)
  }
  return result
}
