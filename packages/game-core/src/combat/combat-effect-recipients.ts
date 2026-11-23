import type {
  CombatActionDefinition,
  CombatActionEvaluation,
  CombatContentCatalog,
  CombatEffectDefinition,
  CombatEncounterState,
  CombatTargetSpec,
  CombatTargetSelection,
} from './actions'
import type { GridPosition } from './board'
import { hasGameplayTag } from './gameplay-tags'

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
    invisibleTargetPolicyVersion?: unknown
  },
  aim?: CombatTargetSpec,
): void {
  if (
    effect.type === 'sensory' &&
    effect.recipient === 'affected-units' &&
    effect.target !== 'ground'
  )
    throw new TypeError('Area Reveal requires Ground target.')
  if (effect.invisibleTargetPolicyVersion !== undefined && effect.type !== 'remove-status')
    throw new TypeError('Invisible targeting policy requires a Dispel removal packet.')
  if (effect.target === undefined) return
  if (effect.target === 'empty-tile' && aim && aim.kind !== 'empty-tile')
    throw new TypeError('Empty Tile effects require an empty shared aim.')
  if (!COMBAT_EFFECT_TARGETS.includes(effect.target as CombatEffectTarget))
    throw new TypeError('Unknown effect target.')
  if (['stat-bonus', 'move', 'damage-bonus', 'endure', 'reversal'].includes(effect.type)) {
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
    (effect.type === 'copy-statuses' ||
      effect.type === 'loot' ||
      (effect.type === 'sensory' && effect.target !== 'ground')) &&
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
 * All includes every living unit independently of the shared aim and friendly fire.
 * Friendly fire only broadens hostile Enemy area packets;
 * explicit ally recovery and Self packets never inherit the hostile mask.
 */
function unfilteredCombatEffectRecipientIds(
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
      if (effect.target === 'all') {
        if (target.allTargetPolicyVersion !== 1) return true
        if (target.friendlyFire === 'enemies-only') return unit.teamId !== actor.teamId
        if (target.friendlyFire === 'allies-only') return unit.teamId === actor.teamId
        return target.friendlyFire !== 'all-except-actor' || unit.id !== actorId
      }
      if (selectedOnly && unit.id !== primaryCombatantId) return false
      if (
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
      // Historical captures retain their pre-Self-damage recipient filtering.
      if (effect.type === 'damage' && unit.id === actorId && state.selfDamagePolicyVersion !== 1)
        return false
      if (effect.target === 'ally') return unit.teamId === actor.teamId && unit.id !== actorId
      if (effect.target === 'enemy')
        return (
          unit.teamId !== actor.teamId ||
          (isHostile && isArea && friendlyFire && unit.id !== actorId)
        )
      if (effect.target === 'ground' || effect.target === 'empty-tile')
        return (
          !isHostile ||
          unit.teamId !== actor.teamId ||
          (friendlyFire &&
            (unit.id !== actorId ||
              (effect.type === 'displace' && state.displacementOriginPolicyVersion === 1) ||
              (effect.type === 'damage' &&
                state.selfDamagePolicyVersion === 1 &&
                target.friendlyFire === 'all-units')))
        )
      return true
    })
    .map((unit) => unit.id)
    .sort((left, right) => {
      // Settle a broadcast's other recipients before a potentially lethal caster hit.
      if (effect.type === 'damage' && effect.target === 'all') {
        if (left === actorId) return 1
        if (right === actorId) return -1
      }
      return left < right ? -1 : left > right ? 1 : 0
    })
}

/** Copy may select an Invisible donor; that exception belongs to its packet only.
 * Real Reveal keeps its existing action-wide authority. Already captured pending recipients
 * retain their admission, and Ground/area packets retain their ordinary delivery rules.
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
  const recipients = unfilteredCombatEffectRecipientIds(
    state,
    actorId,
    primaryCombatantId,
    affectedCombatantIds,
    affectedTiles,
    effect,
    target,
    content,
    capturedRecipients,
  )
  // Current native and captured packets can include their caster even without an authored target.
  // Finish the packet before actor defeat advances a turn or decides the battle.
  if (state.selfDamagePolicyVersion === 1 && effect.type === 'damage')
    recipients.sort((left, right) => (left === actorId ? 1 : right === actorId ? -1 : 0))
  if (
    !content ||
    capturedRecipients ||
    target.revealConcealedTargets ||
    target.shape.kind !== 'single' ||
    target.kind !== 'unit' ||
    ['all', 'ground', 'empty-tile'].includes(effect.target ?? '') ||
    (effect.type === 'copy-statuses' &&
      effect.mode === 'amplify' &&
      effect.invisibleDonorPolicyVersion === 1) ||
    (effect.type === 'remove-status' && effect.invisibleTargetPolicyVersion === 1)
  )
    return recipients
  const actor = state.tactical.battle.combatants.find((unit) => unit.id === actorId)
  return recipients.filter((id) => {
    const unit = state.tactical.battle.combatants.find((candidate) => candidate.id === id)
    return unit?.teamId === actor?.teamId || !hasGameplayTag(state, id, 'Invisible', content)
  })
}

/** Selection admission is limited to marked Dispel packets that can actually affect each
 * selected Invisible enemy; a Self/Ally packet cannot admit an unrelated hostile target.
 */
export function combatDispelAdmitsInvisibleSelection(
  state: CombatEncounterState,
  actorId: string,
  action: CombatActionDefinition,
  selection: CombatTargetSelection,
  content: CombatContentCatalog,
): boolean {
  const actor = state.tactical.battle.combatants.find((unit) => unit.id === actorId)
  const selected = selection.kind === 'selections' ? selection.selections : [selection]
  const invisibleEnemies = selected.flatMap((choice) => {
    if (choice.kind !== 'unit') return []
    const unit = state.tactical.battle.combatants.find(
      (candidate) => candidate.id === choice.combatantId,
    )
    return unit &&
      unit.teamId !== actor?.teamId &&
      hasGameplayTag(state, unit.id, 'Invisible', content)
      ? [unit.id]
      : []
  })
  return (
    invisibleEnemies.length > 0 &&
    invisibleEnemies.every((id) => {
      const position = state.tactical.placements.find(
        (placement) => placement.combatantId === id,
      )?.position
      if (!position) return false
      return action.effects.some(
        (effect, ordinal) =>
          (action.effectEligibleRecipientIds?.[ordinal] === undefined ||
            action.effectEligibleRecipientIds[ordinal]!.includes(id)) &&
          effect.type === 'remove-status' &&
          effect.invisibleTargetPolicyVersion === 1 &&
          combatEffectRecipientIds(
            state,
            actorId,
            id,
            [id],
            [position],
            effect,
            action.target,
            content,
          ).includes(id),
      )
    })
  )
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

/** Packet coverage for forecasts; never substitutes for the action's shared casting aim. */
export function combatEvaluatedActionRecipientIds(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation,
  content?: CombatContentCatalog,
): string[] {
  if (!evaluation.legal) return []
  return [
    ...new Set(
      action.effects.flatMap((_, ordinal) =>
        combatEvaluatedEffectRecipientIds(state, action, evaluation, ordinal, content),
      ),
    ),
  ].sort()
}
