import type {
  CombatActionDefinition,
  CombatActionEvaluation,
  CombatContentCatalog,
  CombatEffectDefinition,
  CombatEncounterState,
  CombatTargetSpec,
} from './actions'
import type { GridPosition } from './board'

export const COMBAT_EFFECT_TARGETS = [
  'self',
  'ally',
  'enemy',
  'anyone',
  'all',
  'ground',
  'empty-tile',
] as const
export type CombatEffectTarget = (typeof COMBAT_EFFECT_TARGETS)[number]

/** Omission is deliberate: immutable native captures retain their original recipient roles. */
export function validateCombatEffectTarget(
  effect: {
    type: string
    recipient: string
    target?: unknown
  },
  aim?: CombatTargetSpec,
): void {
  if (effect.target === undefined) return
  if (effect.target === 'empty-tile' && aim && aim.kind !== 'empty-tile')
    throw new TypeError('Empty Tile effects require an empty shared aim.')
  if (!COMBAT_EFFECT_TARGETS.includes(effect.target as CombatEffectTarget))
    throw new TypeError('Unknown effect target.')
  if (['move', 'damage-bonus', 'endure', 'reversal'].includes(effect.type)) {
    if (effect.target !== 'self' || effect.recipient !== 'actor')
      throw new TypeError('This effect supports only the Self target.')
    return
  }
  if (
    effect.type === 'return-to-turn-start' &&
    ['ground', 'empty-tile'].includes(effect.target as string)
  )
    throw new TypeError('Rewind requires a unit target.')
  if (effect.type === 'summon') {
    if (effect.target !== 'empty-tile') throw new TypeError('Summon requires Empty Tile target.')
    return
  }
  if (effect.type === 'create-terrain') {
    if (!['ground', 'empty-tile'].includes(effect.target as string))
      throw new TypeError('Terrain requires Ground or Empty Tile target.')
    return
  }
  if ((effect.target === 'self') !== (effect.recipient === 'actor'))
    throw new TypeError('Effect target must agree with its actor recipient.')
  if (
    ['sensory', 'copy-statuses'].includes(effect.type) &&
    !['ally', 'enemy', 'anyone'].includes(effect.target as string)
  )
    throw new TypeError('This effect requires a selected unit target.')
}

function hostile(effect: CombatEffectDefinition, content?: CombatContentCatalog): boolean {
  return (
    ['damage', 'poison', 'bleed', 'burn', 'displace', 'sensory'].includes(effect.type) ||
    (effect.type === 'resource-change' && effect.delta < 0) ||
    (effect.type === 'apply-status' &&
      content?.statuses.some(
        (status) => status.id === effect.statusId && status.polarity === 'negative',
      ) === true)
  )
}

/** The shared spatial footprint is resolved once by targeting. Each packet filters it independently.
 * All bypasses that footprint. Friendly fire only broadens hostile Enemy/All area packets;
 * explicit ally recovery and Self packets never inherit the hostile mask.
 */
export function combatEffectRecipientIds(
  state: CombatEncounterState,
  actorId: string,
  primaryCombatantId: string | null,
  affectedCombatantIds: readonly string[],
  affectedTiles: readonly GridPosition[],
  effect: CombatEffectDefinition,
  target: CombatTargetSpec,
  content?: CombatContentCatalog,
  capturedRecipients = false,
): string[] {
  if (effect.recipient === 'affected-tiles') return []
  if (effect.target === undefined || capturedRecipients) {
    if (effect.recipient === 'actor') return [actorId]
    if (effect.recipient === 'primary-unit') return primaryCombatantId ? [primaryCombatantId] : []
    return [...affectedCombatantIds]
  }
  if (effect.target === 'self') return [actorId]
  const actor = state.tactical.battle.combatants.find((unit) => unit.id === actorId)
  if (!actor) throw new TypeError('Effect targeting requires the committed actor.')
  const isHostile = hostile(effect, content)
  const friendlyFire = ['all-units', 'all-except-actor'].includes(target.friendlyFire)
  const isArea = target.shape.kind !== 'single' || effect.target === 'all'
  const selectedOnly = effect.type === 'copy-statuses' || effect.type === 'sensory'
  return state.tactical.battle.combatants
    .filter((unit) => {
      if (unit.hp <= 0) return false
      if (selectedOnly && unit.id !== primaryCombatantId) return false
      if (
        effect.target !== 'all' &&
        !state.tactical.placements.some(
          (placement) =>
            placement.combatantId === unit.id &&
            affectedTiles.some(
              (position) =>
                position.x === placement.position.x && position.y === placement.position.y,
            ),
        )
      )
        return false
      // The actor is not a legal direct-damage recipient until self-defeat is supported.
      if (effect.type === 'damage' && unit.id === actorId) return false
      if (effect.target === 'ally') return unit.teamId === actor.teamId && unit.id !== actorId
      if (effect.target === 'enemy')
        return (
          unit.teamId !== actor.teamId ||
          (isHostile && isArea && friendlyFire && unit.id !== actorId)
        )
      if (effect.target === 'all' || effect.target === 'ground' || effect.target === 'empty-tile')
        return !isHostile || unit.teamId !== actor.teamId || (friendlyFire && unit.id !== actorId)
      return true
    })
    .map((unit) => unit.id)
    .sort()
}

/** Forecast, hit/critical/resistance rolls and the executor share the same packet candidates. */
export function combatEvaluatedEffectRecipientIds(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation,
  ordinal: number,
  content?: CombatContentCatalog,
): string[] {
  if (!evaluation.actorId) return []
  const ids = combatEffectRecipientIds(
    state,
    evaluation.actorId,
    evaluation.primaryCombatantId,
    evaluation.affectedCombatantIds,
    evaluation.affectedTiles,
    action.effects[ordinal]!,
    action.target,
    content,
  )
  const eligible = action.effectEligibleRecipientIds?.[ordinal]
  return eligible === undefined ? ids : ids.filter((id) => eligible.includes(id))
}
