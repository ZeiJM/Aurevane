import { applyAbilityTimingDefaults } from '@aurevane/game-core/combat/combat-definition'
import type {
  AbilityBehavior,
  AbilityEffect,
  RequirementNode,
} from '@aurevane/game-core/combat/combat-definition'
import type { BasicSkillDefinition } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  nativeCombatTagPayload,
  combatTagPayloadExplanation,
} from '@aurevane/game-core/combat/combat-tag-registry'
import {
  canonicalAbilityTargetSpec,
  combatTargetCategories,
} from '@aurevane/game-core/combat/combat-targeting-shapes'
import {
  combatEffectTimingMode,
  currentCombatEffectTimingTag,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { gameplayStatusName } from '@/lib/battle/combat-interaction-presentation'
import { abilityCostDescription } from '@/lib/battle/ability-cost-presentation'
import { skillInformationRows } from './skill-information-contract'
import {
  compactSkillEffectSummaryParts,
  skillEffectDescription,
  skillTargetMethodDescription,
  skillTargetElevationDescription,
  skillCompactRangeDescription,
  skillLineOfSightDescription,
  type CompactSkillEffectSummaryParts,
} from './skill-detail-presentation'
import type { SkillEffectTimingPolicy } from './skill-effect-timing-context'
import type { BasicActionCharacterStats } from './basic-action-presentation'
export type AbilityEffectPresentationContext = NonNullable<
  Parameters<typeof skillEffectDescription>[1]
>

const subjects = {
  owner: 'You',
  selected: 'Each selected unit',
  affected: 'Affected unit',
  triggering: 'Triggering unit',
} as const

/** The same typed requirement tree is used for execution; this is read-only prose. */
export function abilityRequirementDescription(node: RequirementNode | null): string {
  if (!node) return 'None'
  switch (node.kind) {
    case 'all':
    case 'any':
      return `${node.kind === 'all' ? 'All' : 'Any'} of (${node.children.map(abilityRequirementDescription).join('; ')})`
    case 'resource-state':
      return `${subjects[node.subject]}: ${node.resource.toUpperCase()} ${node.comparison === 'at-least' ? '≥' : '≤'} ${node.basisPoints === undefined ? node.amount : `${node.basisPoints / 100}%`}`
    case 'resource-threshold-crossing':
      return `${subjects[node.subject]}: ${node.resource.toUpperCase()} crosses ${node.direction} ${node.thresholdBasisPoints / 100}%`
    case 'status-presence':
      return `${subjects[node.subject]} ${node.present ? 'must have' : 'must not have'} ${gameplayStatusName(node.statusId)}`
    case 'prime-presence':
      return `${subjects[node.subject]} ${node.present ? 'must have' : 'must not have'} ${node.abilityId} primed`
    case 'event':
      return `${node.phase === 'before' ? 'Before' : 'After'} ${node.eventType.replaceAll('_', ' ')}`
    case 'action':
      return (
        [
          node.classification,
          node.attackFamily,
          node.sourceDisciplineId,
          ...(node.requiredTags ?? []),
        ]
          .filter(Boolean)
          .join(' / ') || 'Any action'
      )
  }
}

export interface AbilityEffectPresentation {
  readonly parts: CompactSkillEffectSummaryParts
  readonly condition: string | null
  readonly recipient: string
}
const recipients = {
  actor: 'Self',
  'primary-unit': 'Selected unit',
  'affected-units': 'Affected units',
  'affected-tiles': 'Affected Ground',
  'selected-tile': 'Selected Ground',
} as const

/** Canonical payloads reuse the established effect display grammar, with exact wrapper timing. */
function effectPresentation(
  effect: AbilityEffect,
  timingPolicy: SkillEffectTimingPolicy,
  basic?: BasicSkillDefinition,
  stats: BasicActionCharacterStats = {},
  controlledAction = false,
  effectContext: AbilityEffectPresentationContext = {},
) {
  const payload = effect.payload
  let parts: CompactSkillEffectSummaryParts, description: string
  if (payload.type === 'move') {
    parts = {
      label: 'Move',
      magnitude: String(payload.maximumTiles),
      duration: null,
      timing: 'Instant',
    }
    description = `Move along a legal path of at most ${payload.maximumTiles} entered tiles, within remaining Movement and Jump. ${basic?.execution.kind === 'basic-move' && basic.execution.costBasis === 'per-terrain-point' ? 'Each traversal point uses the captured AP price; terrain and movement modifiers apply.' : 'Movement is included in the Skill cost; no extra traversal AP is charged.'}`
  } else if (payload.type === 'damage-bonus') {
    parts = {
      label: 'Damage Up',
      magnitude: `${(payload.multiplierBasisPoints - 10000) / 100}%`,
      duration: null,
    }
    description = combatTagPayloadExplanation(payload).full
  } else if (payload.type === 'summon') {
    parts = {
      label: 'Summon',
      magnitude: payload.profile.name,
      duration: `${payload.profile.lifetimeTurns} Turns`,
    }
    description = combatTagPayloadExplanation(payload).full
  } else {
    const native = nativeCombatTagPayload(payload)
    parts = compactSkillEffectSummaryParts(native, timingPolicy, {
      explicitElemental: true,
      ...effectContext,
    })
    const mode =
      effect.timing ??
      (parts.timing === 'Instant'
        ? 'instant'
        : combatEffectTimingMode(timingPolicy ?? undefined, currentCombatEffectTimingTag(native)))
    parts = {
      ...parts,
      timing:
        mode === 'controlled'
          ? 'Controlled'
          : mode === 'delayed'
            ? 'Delayed'
            : mode === 'instant' && native.type !== 'damage'
              ? 'Instant'
              : undefined,
    }
    description = skillEffectDescription(native, {
      timingPolicy,
      explicitElemental: true,
      ...effectContext,
      rewindPrimeAnchor: controlledAction,
    })
    if (payload.type === 'pierce') {
      parts = {
        ...parts,
        label: 'Pierce',
        magnitude: `${payload.amount}; ${payload.armorIgnoredBasisPoints / 100}% equipment Armor ignored`,
      }
      description += ` Ignores ${payload.armorIgnoredBasisPoints / 100}% of equipment Armor.`
    }
    if (
      (payload.type === 'damage' || payload.type === 'pierce') &&
      basic?.execution.kind === 'basic-attack'
    ) {
      const family = (stats.mysticPower ?? 0) > (stats.physicalPower ?? 0) ? 'Mystic' : 'Physical'
      parts = {
        ...parts,
        magnitude: `${payload.amount} + floor(${basic.execution.scalingBasisPoints / 100}% ${family} Power)${payload.type === 'pierce' ? `; ${payload.armorIgnoredBasisPoints / 100}% equipment Armor ignored` : ''}`,
      }
      description = `Deal the authored base plus ${basic.execution.scalingBasisPoints / 100}% of your stronger Physical or Mystic Power, rounded down before mitigation. Physical wins ties.`
      if (payload.type === 'pierce')
        description += ` Ignores ${payload.armorIgnoredBasisPoints / 100}% of equipment Armor.`
    }
    if (payload.type === 'percentage-recovery' && basic?.execution.kind === 'basic-action')
      description +=
        basic.execution.recoveryRounding === 'nearest'
          ? ' Uses the nearest whole resource amount.'
          : ' Rounds the resource amount down.'
    if (mode === 'next-round') description += ' Activates at the next global round boundary.'
    if (mode === 'delayed') description += ' Activates two global round boundaries later.'
    if (mode === 'controlled')
      description +=
        ' Controlled primes the whole selected action for free, once per character and ability per battle. Choose a legal release to pay the full action cost and start its cooldown. Invalid releases retain the prime; cancellation discards it without renewing that allowance.'
  }
  const condition = effect.requirements ? abilityRequirementDescription(effect.requirements) : null
  return {
    presentation: { parts, condition, recipient: recipients[payload.recipient] },
    description: `${condition ? `If ${condition}: ` : ''}${description}`,
  }
}

export function abilityBehaviorInformation(
  behavior: AbilityBehavior,
  options: {
    timingPolicy?: SkillEffectTimingPolicy
    basic?: BasicSkillDefinition
    stats?: BasicActionCharacterStats
    effectContext?: AbilityEffectPresentationContext
  } = {},
) {
  const timingPolicy = options.timingPolicy ?? null
  behavior = applyAbilityTimingDefaults(behavior, timingPolicy ?? undefined)
  const controlledAction = behavior.effects.some((effect) => effect.timing === 'controlled')
  const effectContext: AbilityEffectPresentationContext = {
    ...options.effectContext,
    skillEffects: behavior.effects.flatMap(({ payload }) =>
      payload.type === 'move' || payload.type === 'damage-bonus' || payload.type === 'summon'
        ? []
        : [nativeCombatTagPayload(payload)],
    ),
  }
  const effects = behavior.effects.map((effect) =>
    effectPresentation(
      effect,
      timingPolicy,
      options.basic,
      options.stats,
      controlledAction,
      effectContext,
    ),
  )
  const target = behavior.targeting ? canonicalAbilityTargetSpec(behavior.targeting) : null
  const nativeMove =
    options.basic?.execution.kind === 'basic-move' &&
    options.basic.execution.costBasis === 'per-terrain-point'
  const move = behavior.effects.find((effect) => effect.payload.type === 'move')?.payload
  const type =
    behavior.classification === 'attack'
      ? `Attack [${options.basic?.execution.kind === 'basic-attack' ? ((options.stats?.mysticPower ?? 0) > (options.stats?.physicalPower ?? 0) ? 'Mystic' : 'Physical') : behavior.attackFamily === 'mystic' ? 'Mystic' : 'Physical'}]`
      : behavior.classification === 'recovery'
        ? 'Recovery'
        : 'Utility'
  const summary = effects
    .map(
      ({ presentation: { parts, condition, recipient } }) =>
        `${condition ? `If ${condition}: ` : ''}${parts.label}${parts.magnitude ? ` [${parts.magnitude}]` : ''}${parts.duration ? ` [${parts.duration}]` : ''}${parts.timing ? ` [${parts.timing}]` : ''}${target?.kind === 'self' && recipient === 'Self' ? '' : ` → ${recipient}`}`,
    )
    .join(', ')
  return {
    ...(behavior.activation === 'ongoing'
      ? {
          maintenance:
            'Active while Requirements are met. Ends when they are no longer met or its source is removed.',
        }
      : {}),
    rows: skillInformationRows({
      'Skill Type':
        behavior.activation === 'manual' && behavior.mode === 'action'
          ? type
          : `${behavior.activation === 'ongoing' ? 'Ongoing' : behavior.activation === 'automatic' ? 'Automatic' : 'Manual'} ${behavior.mode === 'modifier' ? 'Modifier' : type}`,
      Cost: abilityCostDescription(behavior.costs) + (nativeMove ? ' per traversal point' : ''),
      Cooldown: behavior.cooldown
        ? `${behavior.cooldown.ownerTurns} ${behavior.cooldown.ownerTurns === 1 ? 'turn' : 'turns'}`
        : 'None',
      Requirements: nativeMove ? 'N/A' : abilityRequirementDescription(behavior.requirements),
      Effects: summary,
      Range: nativeMove
        ? options.stats?.move === undefined
          ? 'Character Move stat'
          : String(
              Math.min(options.stats.move, move?.type === 'move' ? move.maximumTiles : Infinity),
            )
        : target
          ? skillCompactRangeDescription({ target })
          : 'N/A',
      Target: nativeMove
        ? 'Empty Ground'
        : target
          ? combatTargetCategories(target)
              .map(
                (category) =>
                  ({
                    self: 'Self',
                    ally: 'Ally',
                    enemy: 'Enemy',
                    ground: target.kind === 'empty-tile' ? 'Empty Ground' : 'Ground',
                  })[category],
              )
              .join(' / ')
          : 'N/A',
      'Target Method': nativeMove
        ? 'Path'
        : target
          ? skillTargetMethodDescription({ target }) +
            ((target.maximumSelections ?? 1) > 1
              ? ` · Up to ${target.maximumSelections} distinct targets`
              : '')
          : 'N/A',
      'Target Elevation': nativeMove
        ? options.stats?.jump === undefined
          ? 'Character Jump stat'
          : String(options.stats.jump)
        : target
          ? skillTargetElevationDescription({ target })
          : 'N/A',
      'Line of Sight': nativeMove
        ? 'Not required'
        : target
          ? skillLineOfSightDescription({ target })
          : 'N/A',
    }),
    effects: effects.map((effect) => effect.presentation),
    effectDescriptions: effects.map((effect) => effect.description),
    limits:
      behavior.activationLimits?.map(
        (limit) =>
          ({
            'once-per-action': 'Once per action',
            'once-per-owner-turn': 'Once per owner turn',
            'once-per-round': 'Once per round',
            'once-per-battle': 'Once per battle',
          })[limit],
      ) ?? [],
  }
}
