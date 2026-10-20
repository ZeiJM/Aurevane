import type { MechanicTextPart } from './mechanic-text'
import { plainMechanicText } from './mechanic-text'
import {
  COMBAT_TRIGGER_MODULES,
  recognizeCombatRequirementModules,
  type CombatRequirementModules,
} from '@aurevane/game-core/combat/combat-requirement-modules'
import { isCleanseEffect } from '@aurevane/game-core/combat/combat-cleanse'
import { mechanicStatusTag, mechanicTag } from './mechanic-text'
import { resolveMechanicText } from './mechanic-tag-explanation'
import { applyAbilityTimingDefaults } from '@aurevane/game-core/combat/combat-definition'
import { combatGroundAreaDescription } from '@aurevane/game-core/combat/combat-ground-visuals'
import type {
  AbilityBehavior,
  AbilityEffect,
  RequirementNode,
} from '@aurevane/game-core/combat/combat-definition'
import type { BasicSkillDefinition } from '@aurevane/game-core/combat/combat-basic-actions'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import {
  canonicalAbilityTargetSpec,
  canonicalAbilitySupportsFireGroundIntent,
  combatTargetCategories,
} from '@aurevane/game-core/combat/combat-targeting-shapes'
import {
  combatEffectTimingMode,
  currentCombatEffectTimingTag,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { gameplayStatusName } from '@/lib/battle/combat-interaction-presentation'
import { abilityCostDescription } from '@/lib/battle/ability-cost-presentation'
import { skillInformationRows } from './skill-information-contract'
import { canonicalEffectExplanation } from './canonical-effect-explanation'
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
  owner: 'Self',
  selected: 'Target',
  affected: 'Area',
  triggering: 'Trigger',
} as const

function requirementTerm(value: string): string {
  return value.replace(/[-_]/gu, ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase())
}

/** Render the executable requirement tree as compact modules; prose never creates a condition. */
export function abilityRequirementDescription(
  node: RequirementNode | null,
  behavior?: AbilityBehavior,
): string {
  if (!node) return 'None'
  if (behavior) {
    const modules = recognizeCombatRequirementModules(node, behavior)
    if (modules) return plainMechanicText(modularRequirementParts(modules)) || 'None'
  }
  switch (node.kind) {
    case 'all':
    case 'any':
      return `(${node.children.map((child) => abilityRequirementDescription(child)).join(node.kind === 'all' ? ' & ' : ' or ')})`
    case 'resource-state':
      return `${node.resource.toUpperCase()} [${node.comparison === 'at-least' ? '≥' : '≤'} ${node.basisPoints === undefined ? node.amount : `${node.basisPoints / 100}%`}] [${subjects[node.subject]}]`
    case 'resource-change':
      return `${node.resource.toUpperCase()} [${node.direction === 'gained' ? 'Gained' : 'Lost'} ≥ ${node.minimumAmount}] [${subjects[node.subject]}]`
    case 'resource-threshold-crossing':
      return `${node.resource.toUpperCase()} [${node.direction === 'below' ? 'Falls Below' : 'Rises Above'} ${node.thresholdBasisPoints / 100}%] [${subjects[node.subject]}]`
    case 'status-presence':
      return `${node.present ? '' : 'No '}${gameplayStatusName(node.statusId)}${requirementSubjectSuffix(node.subject)}`
    case 'subject-relation':
      return `${node.relation === 'same-unit' ? 'Same Unit' : node.relation === 'ally' ? 'Ally, excluding Self' : 'Enemy'} [${subjects[node.subject]} / ${subjects[node.otherSubject]}]`
    case 'prime-presence':
      return `${node.present ? '' : 'No '}${node.abilityId ? `${requirementTerm(node.abilityId.split('.').at(-1) ?? node.abilityId)} [Primed]` : 'Primed'} [${subjects[node.subject]}]`
    case 'event':
      return `${requirementTerm(node.eventType)} [${node.phase === 'before' ? 'Before' : 'After'}]`
    case 'action': {
      return [
        node.classification
          ? node.classification === 'recovery'
            ? 'Heal'
            : requirementTerm(node.classification)
          : 'Action',
        node.attackFamily ? `[${requirementTerm(node.attackFamily)}]` : null,
        node.sourceDisciplineId ? `[${requirementTerm(node.sourceDisciplineId)}]` : null,
        ...(node.requiredTags ?? []).map((tag) => `[${requirementTerm(tag)}]`),
      ]
        .filter(Boolean)
        .join(' ')
    }
  }
}

function requirementSubjectSuffix(subject: 'owner' | 'selected' | 'affected' | 'triggering') {
  return subject === 'selected'
    ? ''
    : ` [${subject === 'owner' ? 'Self' : subject === 'affected' ? 'Area' : 'Trigger'}]`
}

/** Raw and historical trees retain every branch, including unregistered identities. */
function primitiveRequirementParts(value: RequirementNode, modular = false): MechanicTextPart[] {
  const suffix = (subject: 'owner' | 'selected' | 'affected' | 'triggering') =>
    modular && subject === 'affected' ? ' [Affected unit]' : requirementSubjectSuffix(subject)
  if (value.kind === 'all' || value.kind === 'any')
    return [
      '(',
      ...value.children.flatMap((child, index) => [
        ...(index ? [value.kind === 'all' ? ' & ' : ' or '] : []),
        ...primitiveRequirementParts(child, modular),
      ]),
      ')',
    ]
  if (value.kind === 'status-presence') {
    const tag = mechanicStatusTag(value.statusId)
    if (tag)
      return [
        ...(value.present ? [] : ['No ']),
        { ...mechanicTag(tag), label: gameplayStatusName(value.statusId) },
        suffix(value.subject),
      ]
  }
  if (value.kind === 'prime-presence' && !value.abilityId)
    return [
      ...(value.present ? [] : ['No ']),
      mechanicTag('primed'),
      ` [${subjects[value.subject]}]`,
    ]
  if (modular && value.kind === 'resource-state') {
    const text = abilityRequirementDescription(value)
    return [
      { ...mechanicTag('resource-threshold'), label: value.resource.toUpperCase() },
      text.slice(value.resource.length),
    ]
  }
  return [abilityRequirementDescription(value)]
}

function modularRequirementParts(modules: CombatRequirementModules): MechanicTextPart[] {
  const result: MechanicTextPart[] = []
  const trigger = modules.trigger
  if (trigger) {
    const definition = COMBAT_TRIGGER_MODULES.find((module) => module.id === trigger.id)!
    result.push({ ...mechanicTag('trigger'), label: definition.label })
    const qualifiers = trigger.parameters.actionQualifiers.flatMap((node) => [
      ...(node.sourceDisciplineId ? [requirementTerm(node.sourceDisciplineId)] : []),
      ...(node.classification
        ? [node.classification === 'recovery' ? 'Heal' : requirementTerm(node.classification)]
        : []),
      ...(node.attackFamily ? [requirementTerm(node.attackFamily)] : []),
      ...(node.requiredTags ?? []).map(requirementTerm),
    ])
    for (const qualifier of new Set(qualifiers)) result.push(` [${qualifier}]`)
    for (const relation of trigger.parameters.causalRelations) {
      const relative =
        relation.otherSubject === 'owner'
          ? relation.subject
          : relation.subject === 'owner'
            ? relation.otherSubject
            : null
      const role =
        relative === 'triggering'
          ? 'Source'
          : relative === 'affected'
            ? 'Recipient'
            : relative === 'selected'
              ? 'Target'
              : null
      result.push(
        role
          ? ` [${role}: ${relation.relation === 'same-unit' ? 'Self' : relation.relation === 'ally' ? 'Ally' : 'Enemy'}]`
          : ` [${abilityRequirementDescription(relation)}]`,
      )
    }
    if (trigger.parameters.crossing)
      result.push(` [${trigger.parameters.crossing.thresholdBasisPoints / 100}%]`)
    if (trigger.parameters.resourceChange)
      result.push(` [≥ ${trigger.parameters.resourceChange.minimumAmount}]`)
  }
  if (modules.conditions.length) {
    if (result.length) result.push(' & ')
    if (modules.conditions.length > 1) result.push('(')
    modules.conditions.forEach((node, index) => {
      if (index) result.push(' & ')
      result.push(...primitiveRequirementParts(node, true))
    })
    if (modules.conditions.length > 1) result.push(')')
  }
  return result
}

function requirementReferenceParts(
  node: RequirementNode | null,
  context: AbilityEffectPresentationContext,
  behavior?: AbilityBehavior,
): readonly MechanicTextPart[] | undefined {
  const modules = behavior ? recognizeCombatRequirementModules(node, behavior) : null
  const result = modules
    ? modularRequirementParts(modules)
    : node
      ? primitiveRequirementParts(node)
      : []
  return result.some((part) => typeof part !== 'string')
    ? resolveMechanicText(result, context)
    : undefined
}

export interface AbilityEffectPresentation {
  readonly parts: CompactSkillEffectSummaryParts
  readonly explanationParts?: readonly MechanicTextPart[]
  readonly condition: string | null
  readonly conditionParts?: readonly MechanicTextPart[]
  readonly recipient: string
  readonly recipientOverride?: string
  readonly repeatsOnEntry?: boolean
}
const recipients = {
  actor: 'Self',
  'primary-unit': 'Target',
  'affected-units': 'Targets',
  'affected-tiles': 'Ground',
  'selected-tile': 'Ground',
} as const

function effectRecipientOverride(
  behavior: AbilityBehavior,
  effect: AbilityEffect,
): string | undefined {
  const target = behavior.targeting ? canonicalAbilityTargetSpec(behavior.targeting) : null
  const selected = target ? combatTargetCategories(target) : []
  const payload = effect.payload
  const actual =
    payload.type === 'move' ||
    payload.recipient === 'selected-tile' ||
    payload.recipient === 'affected-tiles'
      ? ['ground']
      : payload.recipient === 'actor'
        ? ['self']
        : target?.friendlyFire === 'enemies-only'
          ? ['enemy']
          : target?.friendlyFire === 'allies-only'
            ? selected.includes('self')
              ? ['self', 'ally']
              : ['ally']
            : selected.filter((category) => category !== 'ground').length
              ? selected.filter((category) => category !== 'ground')
              : ['self', 'ally', 'enemy']
  if (actual.every((category) => selected.some((value) => value === category))) return undefined
  return actual
    .map(
      (category) =>
        ({ self: 'Self', ally: 'Ally', enemy: 'Enemy', ground: 'Ground' })[
          category as 'self' | 'ally' | 'enemy' | 'ground'
        ],
    )
    .join(' / ')
}

const equipmentArmorExplanation =
  'The displayed bypass applies only to equipment Armor. Without equipment Armor, it provides no advantage.'

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
  let explanationParts: readonly MechanicTextPart[] | undefined
  if (payload.type === 'move') {
    parts = {
      label: 'Move',
      magnitude: String(payload.maximumTiles),
      duration: null,
      timing: 'Instant',
    }
    description = 'Move to the chosen Ground within your remaining Movement and Jump.'
  } else if (payload.type === 'damage-bonus') {
    parts = {
      label: 'Damage Up',
      magnitude: `${(payload.multiplierBasisPoints - 10000) / 100}%`,
      duration: null,
    }
    description = 'Increase damage dealt.'
  } else if (payload.type === 'summon') {
    parts = {
      label: 'Summon',
      magnitude: payload.profile.name,
      duration: `${payload.profile.lifetimeTurns} Turns`,
    }
    description = 'Summon an allied companion on the chosen empty Ground.'
  } else {
    const native = nativeCombatTagPayload(payload)
    parts = compactSkillEffectSummaryParts(native, timingPolicy, {
      explicitElemental: true,
      ...effectContext,
      ...(effect.timing ? { timingMode: effect.timing } : {}),
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
    const plain = canonicalEffectExplanation(native, {
      ...effectContext,
      timingPolicy,
      timingMode: mode,
    })
    description =
      plain?.description ??
      skillEffectDescription(native, {
        timingPolicy,
        explicitElemental: true,
        ...effectContext,
        rewindPrimeAnchor: controlledAction,
      })
    if (plain?.descriptionParts) explanationParts = plain.descriptionParts
    if (plain?.parts)
      parts = {
        ...parts,
        ...plain.parts,
        magnitude: parts.magnitude ?? plain.parts.magnitude ?? null,
      }
    if (payload.type === 'pierce') {
      parts = {
        ...parts,
        label: 'Pierce',
        magnitude: String(payload.amount),
        details: [
          ...(parts.details ?? []),
          { label: 'Armor ignored', value: `${payload.armorIgnoredBasisPoints / 100}%` },
        ],
      }
      description +=
        timingPolicy?.tagAuthority === 'global'
          ? ' Break the target’s Barrier. The bypass affects equipment Armor; Physical and Mystic Defense still apply.'
          : ` ${equipmentArmorExplanation}`
    }
    if (
      (payload.type === 'damage' || payload.type === 'pierce') &&
      basic?.execution.kind === 'basic-attack'
    ) {
      const family = (stats.mysticPower ?? 0) > (stats.physicalPower ?? 0) ? 'Mystic' : 'Physical'
      parts = {
        ...parts,
        magnitude: `${payload.amount} + floor(${basic.execution.scalingBasisPoints / 100}% ${family} Power)`,
      }
      description = `Deal base damage plus ${basic.execution.scalingBasisPoints / 100}% of your stronger Physical or Mystic Power, rounded down before mitigation. Physical wins ties.`
      if (payload.type === 'pierce')
        description +=
          timingPolicy?.tagAuthority === 'global'
            ? ' Break the target’s Barrier. The bypass affects equipment Armor; Physical and Mystic Defense still apply.'
            : ` ${equipmentArmorExplanation}`
    }
    if (payload.type === 'percentage-recovery' && basic?.execution.kind === 'basic-action')
      description +=
        basic.execution.recoveryRounding === 'nearest'
          ? ' Uses the nearest whole resource amount.'
          : ' Rounds the resource amount down.'
  }
  if (explanationParts) {
    const prefix = explanationParts
      .map((part) => (typeof part === 'string' ? part : part.label))
      .join('')
    // Wrappers may append timing or Controlled rules, but never rewrite the sentence.
    explanationParts = description.startsWith(prefix)
      ? resolveMechanicText([...explanationParts, description.slice(prefix.length)], effectContext)
      : undefined
  }
  if (parts.details?.some((detail) => detail.labelParts))
    parts = {
      ...parts,
      details: parts.details.map((detail) =>
        detail.labelParts
          ? { ...detail, labelParts: resolveMechanicText(detail.labelParts, effectContext) }
          : detail,
      ),
    }
  parts = {
    ...parts,
    duration:
      parts.duration
        ?.replace(/recipient turn ends/gu, 'Turns')
        .replace(/recipient turn end/gu, 'Turn')
        .replace(/full rounds/gu, 'Rounds')
        .replace(/full round/gu, 'Round') ?? null,
  }
  if (parts.timing === 'Instant' && /^1 (?:affected )?turns?$/iu.test(parts.duration ?? ''))
    parts = { ...parts, duration: null }
  const condition = effect.requirements ? abilityRequirementDescription(effect.requirements) : null
  const conditionParts = requirementReferenceParts(effect.requirements ?? null, effectContext)
  return {
    presentation: {
      parts,
      condition,
      ...(conditionParts ? { conditionParts } : {}),
      recipient: recipients[payload.recipient],
      ...(explanationParts ? { explanationParts } : {}),
    },
    description,
  }
}

/** The Cleanse explanation already lists this exact recipient eligibility. */
function repeatsCleanseEligibility(effect: AbilityEffect, preceding: readonly AbilityEffect[]) {
  const requirement = effect.requirements
  if (effect.payload.type !== 'percentage-recovery' || requirement?.kind !== 'any') return false
  const subject =
    effect.payload.recipient === 'actor'
      ? 'owner'
      : effect.payload.recipient === 'primary-unit'
        ? 'selected'
        : 'affected'
  return preceding.some(({ payload, requirements }) => {
    if (
      payload.type !== 'remove-status' ||
      !isCleanseEffect(payload) ||
      requirements ||
      payload.recipient !== effect.payload.recipient
    )
      return false
    const statuses = new Set([...payload.statusIds, 'suppress'])
    return (
      requirement.children.length === statuses.size &&
      [...statuses].every((statusId) =>
        requirement.children.some(
          (child) =>
            child.kind === 'status-presence' &&
            child.present &&
            child.subject === subject &&
            child.statusId === statusId,
        ),
      )
    )
  })
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
  const groundFire = canonicalAbilitySupportsFireGroundIntent(
    behavior,
    options.effectContext?.legacyElemental
      ? null
      : options.effectContext?.explicitElemental === false
        ? 1
        : 2,
  )
  const effectContext: AbilityEffectPresentationContext = {
    ...options.effectContext,
    skillEffects: behavior.effects.flatMap(({ payload }) =>
      payload.type === 'move' || payload.type === 'damage-bonus' || payload.type === 'summon'
        ? []
        : [nativeCombatTagPayload(payload)],
    ),
  }
  const effects = behavior.effects.map((effect, index) => {
    const recipientOverride = effectRecipientOverride(behavior, effect)
    const described = effectPresentation(
      effect,
      timingPolicy,
      options.basic,
      options.stats,
      controlledAction,
      effectContext,
    )
    const redundantEligibility = repeatsCleanseEligibility(effect, behavior.effects.slice(0, index))
    return {
      ...described,
      ...(redundantEligibility
        ? {
            description: `${described.description} Applies only if the recipient has an effect that Cleanse can remove.`,
          }
        : {}),
      presentation: {
        ...described.presentation,
        ...(redundantEligibility ? { condition: null, conditionParts: undefined } : {}),
        ...(recipientOverride ? { recipientOverride } : {}),
        ...(behavior.groundArea
          ? { repeatsOnEntry: behavior.groundArea.entryEffectIds.includes(effect.id) }
          : {}),
      },
    }
  })
  const target = behavior.targeting ? canonicalAbilityTargetSpec(behavior.targeting) : null
  const nativeMove =
    options.basic?.execution.kind === 'basic-move' &&
    options.basic.execution.costBasis === 'per-terrain-point'
  const move = behavior.effects.find((effect) => effect.payload.type === 'move')?.payload
  const type =
    behavior.classification === 'attack'
      ? `Attack [${options.basic?.execution.kind === 'basic-attack' ? ((options.stats?.mysticPower ?? 0) > (options.stats?.physicalPower ?? 0) ? 'Mystic' : 'Physical') : behavior.attackFamily === 'mystic' ? 'Mystic' : 'Physical'}]`
      : behavior.classification === 'recovery'
        ? 'Heal'
        : 'Utility'
  const summary = effects
    .map(
      ({ presentation: { parts, condition, recipientOverride } }) =>
        `${condition ? `If ${condition}: ` : ''}${parts.label}${parts.magnitude ? ` [${parts.magnitude}]` : ''}${parts.duration ? ` [${parts.duration}]` : ''}${parts.timing ? ` [${parts.timing}]` : ''}${recipientOverride ? ` [${recipientOverride}]` : ''}`,
    )
    .join(', ')
  const requirementParts = nativeMove
    ? undefined
    : requirementReferenceParts(behavior.requirements, effectContext, behavior)
  const groundSummary = behavior.groundArea
    ? timingPolicy?.tagAuthority === 'global'
      ? `${behavior.groundArea.durationRounds} ${behavior.groundArea.durationRounds === 1 ? 'Round' : 'Rounds'}${behavior.groundArea.timing === 'instant' ? ' [Instant]' : behavior.groundArea.timing === 'delayed' ? ' [Delayed]' : ''}`
      : `${groundFire ? 'Ground casts: ' : ''}${combatGroundAreaDescription(behavior.groundArea, timingPolicy?.modes['ground-area'] === 'instant' || timingPolicy?.modes['ground-area'] === 'delayed' ? timingPolicy.modes['ground-area'] : 'next-round', true)}`
    : null
  return {
    ...(requirementParts ? { requirementParts } : {}),
    ...(behavior.activation === 'ongoing'
      ? {
          maintenance:
            'Active while Requirements are met. Ends when they are no longer met or its source is removed.',
        }
      : {}),
    rows: skillInformationRows({
      'Skill Type': type,
      Cost: abilityCostDescription(behavior.costs) + (nativeMove ? ' per traversal point' : ''),
      Cooldown: behavior.cooldown
        ? `${behavior.cooldown.ownerTurns} ${behavior.cooldown.ownerTurns === 1 ? 'turn' : 'turns'}`
        : 'None',
      Requirements: nativeMove
        ? 'N/A'
        : abilityRequirementDescription(behavior.requirements, behavior),
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
          ? (groundFire ? ['enemy' as const, 'ground' as const] : combatTargetCategories(target))
              .map(
                (category) =>
                  ({
                    self: 'Self',
                    ally: 'Ally',
                    enemy: 'Enemy',
                    ground: target.kind === 'empty-tile' ? 'Empty Ground' : 'Ground',
                  })[category],
              )
              .join(' / ') + (groundSummary ? ` · ${groundSummary}` : '')
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
