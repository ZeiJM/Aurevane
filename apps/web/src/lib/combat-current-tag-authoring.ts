import { deriveSharedEffectAim } from '@aurevane/game-core/combat/combat-effect-target-authoring'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import type { CombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import {
  selectableCombatStatusIds,
  COPY_DEBUFF_EXCLUDED_STATUS_IDS,
} from '@aurevane/game-core/combat/combat-status-selection'
import {
  withCurrentSummonCoreAttributes,
  type SummonProfileDefinition,
} from '@aurevane/game-core/combat/summon-content'
import {
  reconcileAuthoredEffectDependencies,
  hasSharedGroundAim,
} from './combat-effect-dependencies'
import { withRemappedGroundEntries } from './combat-ground-entry-authoring'
import { effectAuthoringTag } from '@aurevane/game-core/combat/combat-effect-authoring'

export function currentSummonForAuthoring(
  profile: SummonProfileDefinition,
): SummonProfileDefinition {
  return {
    ...withCurrentSummonCoreAttributes(profile),
    aiProfile: 'high',
    neverMoves: profile.neverMoves ?? false,
    abilities: profile.abilities.map((ability) => {
      const proposed = ability.effects.map((effect) => currentTagForAuthoring(effect))
      const effects = reconcileAuthoredEffectDependencies(proposed, proposed, {
        inheritedGround: hasSharedGroundAim(ability.target),
      })
      const hasDamage = effects.some((effect) => effect.type === 'damage' && effect.amount > 0)
      const family = ability.tags.includes('mystic') ? 'mystic' : 'physical'
      const reversal = effects.some((effect) => effect.type === 'reversal')
      const fixedSelf = reversal || effects.some((effect) => effect.type === 'endure')
      return withRemappedGroundEntries(ability, {
        ...ability,
        hpCost: ability.hpCost ?? 0,
        target: fixedSelf ? deriveSharedEffectAim(ability.target, effects) : ability.target,
        tags: reversal
          ? [...new Set([...ability.tags.filter((tag) => tag !== 'attack'), 'utility'])]
          : hasDamage
            ? [
                ...new Set([
                  ...ability.tags.filter((tag) => !['physical', 'mystic'].includes(tag)),
                  'attack',
                  family,
                ]),
              ]
            : ability.tags,
        effects,
      })
    }),
  }
}

/** Current editor defaults apply to an explicit edit/commit, never to battle history. */
export function currentTagForAuthoring(value: CombatEffectDefinition): CombatEffectDefinition
export function currentTagForAuthoring(value: CombatTagPayload): CombatTagPayload
export function currentTagForAuthoring(
  value: CombatTagPayload | CombatEffectDefinition,
): CombatTagPayload | CombatEffectDefinition {
  if (value.type === 'endure' && value.target === undefined) return { ...value, target: 'self' }
  if (value.type === 'summon')
    return { ...value, profile: currentSummonForAuthoring(value.profile) }
  if (value.type === 'damage' && value.vengeance)
    return {
      type: 'apply-status',
      recipient: value.recipient,
      statusId: 'counter',
      stacks: 1,
      durationTurns: value.durationTurns && value.durationTurns > 0 ? value.durationTurns : 2,
      counter: { kind: 'full', basisPoints: value.vengeance.conversionBasisPoints },
      ...(value.target ? { target: value.target } : {}),
      ...(value.authoringLink ? { authoringLink: value.authoringLink } : {}),
    }
  if (value.type === 'resource-change' && value.delta < 0 && value.basis === undefined)
    return { ...value, basis: 'maximum-mp-percent' }
  if (value.type === 'sensory' && value.increasedDamageTakenBasisPoints === undefined)
    return { ...value, increasedDamageTakenBasisPoints: 1500 }
  if (
    value.type === 'remove-status' &&
    effectAuthoringTag(value).id === 'cleanse' &&
    value.removalMode !== 'all-debuffs'
  )
    return { ...value, removalMode: 'all-debuffs' }
  if (value.type === 'remove-status' && effectAuthoringTag(value).id === 'dispel')
    return {
      ...value,
      removalMode: 'specified',
      selectionKind: 'buffs',
      invisibleTargetPolicyVersion: 1,
      statusIds: value.statusIds.filter((id) => id !== 'endure'),
    }
  if (value.type === 'remove-status' && value.selectionKind === undefined) {
    const tag = effectAuthoringTag(value).id
    if (tag === 'dispel' || tag === 'conditional-cleanse')
      return {
        ...value,
        removalMode: 'specified',
        selectionKind: tag === 'dispel' ? 'buffs' : 'debuffs',
      }
  }
  if (value.type === 'copy-statuses') {
    const allowed = selectableCombatStatusIds(
      value.mode === 'amplify' ? 'copy-buffs' : 'copy-debuffs',
    )
    if (value.mode === 'amplify') {
      const historicalAll = [...allowed.filter((id) => id !== 'covert'), 'blindside']
      const wasAll =
        value.statusIds?.length === historicalAll.length &&
        historicalAll.every((id) => value.statusIds?.includes(id))
      return {
        ...value,
        invisibleDonorPolicyVersion: 1,
        durationPolicyVersion: 1,
        statusIds:
          value.statusIds === undefined || wasAll
            ? [...allowed]
            : value.statusIds.filter((id) => id !== 'blindside'),
      }
    }
    const selected = value.statusIds?.filter((id) => !COPY_DEBUFF_EXCLUDED_STATUS_IDS.includes(id))
    const priorAll = allowed.filter((id) => id !== 'blind')
    const wasAll =
      selected?.length === priorAll.length && priorAll.every((id) => selected.includes(id))
    return {
      ...value,
      durationPolicyVersion: 1,
      statusIds:
        value.statusIds === undefined || wasAll
          ? [...allowed]
          : value.statusIds.filter((id) => !COPY_DEBUFF_EXCLUDED_STATUS_IDS.includes(id)),
    }
  }
  if (value.type === 'apply-status') {
    if (value.statusId === 'wet' && value.initiativeReductionBasisPoints === undefined)
      return { ...value, initiativeReductionBasisPoints: 1000 }
    if (value.statusId === 'fortified' && value.defenseIncreaseBasisPoints === undefined)
      return { ...value, defenseIncreaseBasisPoints: value.potencyBasisPoints ?? 1500 }
    if (['haste', 'slow'].includes(value.statusId) && value.movementApAdjustment === undefined)
      return { ...value, movementApAdjustment: 10 }
    if (value.statusId === 'lowered-guard' && value.damageTakenMultiplierBasisPoints === undefined)
      return {
        ...value,
        damageTakenMultiplierBasisPoints:
          value.potencyBasisPoints === undefined ? 25000 : 10000 + value.potencyBasisPoints,
      }
  }
  return value
}
