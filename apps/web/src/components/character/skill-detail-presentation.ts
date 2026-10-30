import { effectTargetLabel, effectFriendlyFireNote } from './effect-target-presentation'
import type { MechanicTextPart } from './mechanic-text'
import { isCleanseChilledEffect } from '@aurevane/game-core/combat/combat-cleanse'
import { groupSkillEffects } from './skill-effect-groups'
import {
  isPercentageDotEffect,
  percentageDotDescription,
} from '@aurevane/game-core/combat/combat-percentage-dots'
import { skillInformationRows } from './skill-information-contract'
import { combatTargetCategories } from '@aurevane/game-core/combat/combat-targeting-shapes'
import {
  elementalStatusOverlapsDamage,
  previewEffect,
  skillDamageElementInteraction,
} from './skill-effect-preview'
import {
  combatActionPresentationTags,
  combatEffectPresentationTags,
  combatTargetIncludesActor,
} from '@aurevane/game-core/combat/gameplay-tags'
import { gameplayStatusName } from '../../lib/battle/combat-interaction-presentation'
import {
  combatStatusDetails,
  combatStatusDuration,
} from '@aurevane/game-core/combat/status-content'
import type { CombatUseRequirement } from '@aurevane/game-core/combat/actions'
import type {
  MatureSkillDefinition,
  MatureSkillEffectDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import { isMaterializedCombatEffect } from '@aurevane/game-core/combat/summon-content'
import {
  combatEffectTimingMode,
  currentCombatEffectTimingTag,
  defaultCombatEffectTimingPolicy,
} from '@aurevane/game-core/combat/combat-effect-timing'
import type { SkillEffectTimingPolicy } from './skill-effect-timing-context'

function title(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function requirementTagName(tag: string): string {
  return tag === 'Frozen'
    ? gameplayStatusName('frozen')
    : tag === 'Wet'
      ? gameplayStatusName('wet')
      : title(tag)
}

function recipient(effect: MatureSkillEffectDefinition): string {
  if (effect.recipient === 'actor') return 'yourself'
  if (effect.recipient === 'affected-units') return 'each affected unit'
  if (effect.recipient === 'selected-tile') return 'the selected empty tile'
  return 'the selected unit'
}

export function skillEffectDescription(
  effect: MatureSkillEffectDefinition,
  options: {
    legacyTriggers?: boolean
    legacyPoisonMovement?: boolean
    legacyFrozenGround?: boolean
    legacyAirborne?: boolean
    legacyAirborneJump?: boolean
    legacyHealingDown?: boolean
    legacyBlindsideActivation?: boolean
    legacyElemental?: boolean
    explicitElemental?: boolean
    rewindPrimeAnchor?: boolean
    skillEffects?: readonly MatureSkillEffectDefinition[]
    timingPolicy?: SkillEffectTimingPolicy
  } = {},
): string {
  const target = recipient(effect)
  if (isPercentageDotEffect(effect))
    return `Apply ${previewEffect(effect).label} to ${target}. ${percentageDotDescription(effect.type, effect.type === 'burn' ? effect.backlashBasisPoints : undefined, options)}`
  switch (effect.type) {
    case 'summon':
      return 'Summon the authored allied unit onto the selected empty tile.'
    case 'damage': {
      const facing = effect.facingModifiersBasisPoints
      const position = facing
        ? ` Facing: front ${facing.front / 100}%, side ${facing.side / 100}%, rear ${facing.rear / 100}%.`
        : ''
      const element = skillDamageElementInteraction(
        effect,
        options.legacyElemental,
        options.timingPolicy,
        options.skillEffects,
        options.explicitElemental,
      )
      return `Deal ${effect.amount} base damage to ${target}.${position}${element}`
    }
    case 'create-terrain':
      return `Create Frozen Ground on affected tiles for two round boundaries. ${options.legacyFrozenGround ? 'Both teams' : 'Only the caster’s enemies'} pay 10 extra AP per entered tile; Airborne ignores this surcharge. Fire converts Frozen Ground to Steam, which blocks line of sight for both teams.`
    case 'displace':
      return `${effect.direction === 'pull' ? 'Pull' : 'Push'} ${target} up to ${effect.distance} ${effect.distance === 1 ? 'tile' : 'tiles'} ${effect.direction === 'pull' ? 'toward you' : 'away'}, one legal tile at a time. Stops before occupied, blocked or illegal-elevation tiles. Pull never enters your tile. Root prevents displacement. Failure grants no refund.`
    case 'poison':
      return `Apply Poison to ${target}.`
    case 'burn': {
      const preview = previewEffect(effect)
      const stages = preview.magnitude!.split('/')
      return `Apply Burn to ${target}. Burn deals ${stages.join(', then ')} fixed damage at the target's next ${stages.length} ${stages.length === 1 ? 'end-turn boundary' : 'end-turn boundaries'} for each active application.`
    }
    case 'bleed':
      return `Apply Bleed to ${target} for ${effect.ticks} ${effect.ticks === 1 ? 'end-turn tick' : 'end-turn ticks'} at ${effect.damagePerTick} damage per tick.`
    case 'return-to-turn-start':
      return options.rewindPrimeAnchor
        ? 'Return to where this Skill was primed. Rooted prevents the return.'
        : effect.anchorMode === 'cast-position'
          ? 'Return to where this Skill was used. Rooted prevents the return.'
          : 'Return to where your turn began. Rooted prevents the return.'
    case 'percentage-recovery':
      return previewEffect(effect, options).explanation
    case 'healing':
      return `Restore up to ${effect.amount} HP to ${target}.${recoveryTiming(effect.ticks)}`
    case 'barrier-change':
      return effect.basis === 'maximum-hp-percent'
        ? `Protect ${target} with a share of maximum HP that absorbs damage before HP. Pierce breaks the Barrier.`
        : `Grant up to ${effect.amount} Barrier to ${target}.`
    case 'resource-change':
      return `${effect.delta >= 0 ? 'Restore up to' : 'Remove'} ${Math.abs(effect.delta)} MP ${effect.delta >= 0 ? 'to' : 'from'} ${target}.${effect.delta >= 0 ? recoveryTiming(effect.ticks) : ''}`
    case 'copy-statuses':
      return effect.mode === 'amplify'
        ? 'Copy eligible positive active statuses from the selected unit onto yourself. The selected unit keeps its statuses; remaining durations are not restarted.'
        : 'Copy eligible negative active statuses from yourself onto the selected unit. You keep the original statuses; remaining durations are not restarted.'
    case 'sensory':
      return `Attempt Reveal on ${target}. On a successful hit against Covert, remove eligible positive statuses and Covert, then apply Revealed for ${effect.revealedDurationOwnerTurnStarts} owner-turn starts. Otherwise Reveal has no effect.`
    case 'remove-status': {
      if (
        isCleanseChilledEffect(effect) &&
        !options.legacyElemental &&
        options.explicitElemental !== false
      )
        return previewEffect(effect, options).explanation
      const statusIds =
        combatEffectPresentationTags(effect).includes('Cleanse') ||
        (isCleanseChilledEffect(effect) &&
          (options.legacyElemental || options.explicitElemental === false))
          ? [...effect.statusIds, 'suppress']
          : effect.statusIds
      const statusNames = [...new Set(statusIds.map((id) => combatStatusDetails(id).name))]
      return `Remove ${statusNames.join(', ')} from ${target}.`
    }
    case 'apply-status': {
      if (effect.statusId === 'suppress')
        return `Apply Suppress to ${target}. ${previewEffect(effect, options).explanation} Lasts ${effect.durationTurns ?? 2} turns.`
      if (
        !options.legacyElemental &&
        options.explicitElemental !== false &&
        ['frozen', 'wet', 'conductive'].includes(effect.statusId)
      )
        return `Apply ${gameplayStatusName(effect.statusId)} to ${target}. ${previewEffect(effect, options).explanation}`
      const status = combatStatusDetails(effect.statusId)
      const preview = previewEffect(effect, options)
      const duration =
        (effect.durationTurns ?? 0) > 0
          ? `Lasts ${effect.durationTurns} ${effect.durationTurns === 1 ? 'turn' : 'turns'}.`
          : combatStatusDuration(effect.statusId)
      const explanation =
        effect.potencyBasisPoints !== undefined ||
        effect.statusId === 'airborne' ||
        effect.statusId === 'hexed' ||
        effect.statusId === 'blindside'
          ? preview.explanation
          : status.description
      return `Apply ${effect.stacks} ${gameplayStatusName(effect.statusId)} ${effect.stacks === 1 ? 'stack' : 'stacks'} to ${target}. ${explanation} ${duration}`
    }
  }
}

export function skillRequirementDescription(requirement: CombatUseRequirement): string {
  switch (requirement.kind) {
    case 'actor-tag-present':
      return `${requirementTagName(requirement.tag)} [Self]`
    case 'actor-tag-absent':
      return `No ${requirementTagName(requirement.tag)} [Self]`
    case 'target-tag-present':
      return `${requirementTagName(requirement.tag)} [Target]`
    case 'actor-status-present':
      return `${gameplayStatusName(requirement.statusId)} [Self]`
    case 'actor-status-absent':
      return `No ${gameplayStatusName(requirement.statusId)} [Self]`
    case 'target-status-present':
      return `${gameplayStatusName(requirement.statusId)} [Target]`
    case 'actor-hp-at-most':
      return `HP ≤ ${requirement.basisPoints / 100}% [Self]`
  }
}

export function skillTargetTags(
  skill: MatureSkillDefinition,
  options: { legacyElemental?: boolean; explicitElemental?: boolean } = {},
): readonly string[] {
  return combatActionPresentationTags({
    target: skill.target,
    effects: skill.effects.filter(isMaterializedCombatEffect),
  }).map((tag) =>
    (options.legacyElemental || options.explicitElemental === false) &&
    tag.startsWith('Cleanse Chilled')
      ? tag.replace('Cleanse Chilled', 'Cleanse')
      : tag,
  )
}

export function skillTypeDescription(
  skill: Pick<MatureSkillDefinition, 'tags' | 'effects' | 'ability'>,
): string {
  if (skill.ability)
    return [
      ...new Set(
        skill.ability.behaviors.map((behavior) =>
          behavior.classification === 'attack'
            ? 'Attack'
            : behavior.classification === 'recovery'
              ? 'Heal'
              : 'Utility',
        ),
      ),
    ].join(' / ')
  if (skill.tags.includes('attack')) return 'Attack'

  const recoversHpOrMp = skill.effects.some(
    (effect) =>
      effect.type === 'percentage-recovery' ||
      effect.type === 'healing' ||
      (effect.type === 'resource-change' && effect.delta > 0),
  )
  return recoversHpOrMp ? 'Heal' : 'Utility'
}

/** The mature Skill executor chooses Mystic Defense for mystic tags, Physical otherwise. */
export function attackSkillTypeDescription(tags: readonly string[]): string {
  return `Attack [${tags.includes('mystic') ? 'Mystic' : 'Physical'}]`
}

export function skillParameterTypeDescription(
  skill: Pick<MatureSkillDefinition, 'tags' | 'effects'>,
): string {
  const type = skillTypeDescription(skill)
  return type === 'Attack' ? attackSkillTypeDescription(skill.tags) : type
}

export function skillCostDescription(
  skill: Pick<MatureSkillDefinition, 'apCost' | 'mpCost' | 'hpCost'>,
): string {
  return [
    `${skill.apCost} AP`,
    ...(skill.mpCost ? [`${skill.mpCost} MP`] : []),
    ...(skill.hpCost ? [`${skill.hpCost} HP`] : []),
  ].join(' / ')
}

/** Parameter order and wording shared by Nexus and committed battle Skills. */
export function skillParameterRows(
  skill: Pick<
    MatureSkillDefinition,
    'tags' | 'effects' | 'apCost' | 'mpCost' | 'hpCost' | 'cooldown' | 'requirements' | 'target'
  >,
  costs: Pick<MatureSkillDefinition, 'apCost' | 'mpCost' | 'hpCost'> & {
    cooldownOwnerTurns?: number | null
  } = skill,
  timingPolicy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
  options: {
    legacyFrozenGround?: boolean
    airborneAttackElevation?: boolean
    legacyElemental?: boolean
    explicitElemental?: boolean
  } = {},
): readonly (readonly [string, string])[] {
  return skillInformationRows({
    'Skill Type': skillParameterTypeDescription(skill),
    Cost: skillCostDescription({ ...skill, ...costs }),
    Cooldown: skillCooldownDescription(skill, costs.cooldownOwnerTurns),
    Requirements: skillRequirementsSummary(skill),
    Effects: skillEffectsSummary(skill, timingPolicy, options),
    'Target Method': skillTargetMethodDescription(skill) + skillDeliveryNotes(skill, options),
    'Target Elevation':
      options.airborneAttackElevation && skill.tags.includes('attack')
        ? '3'
        : skillTargetElevationDescription(skill),
    'Line of Sight': skillLineOfSightDescription(skill),
  })
}

interface ElementalEffectPresentationOptions {
  timingMode?: 'instant' | 'delayed' | 'controlled' | 'next-round'
  legacyHealingDown?: boolean
  legacyElemental?: boolean
  explicitElemental?: boolean
  skillEffects?: readonly MatureSkillEffectDefinition[]
  aim?: MatureSkillDefinition['target']
}

export interface CompactSkillEffectSummaryParts {
  label: string
  target?: string
  magnitude: string | null
  duration: string | null
  timing?: 'Instant' | 'Delayed' | 'Controlled'
  details?: readonly {
    readonly label: string
    readonly value: string
    readonly labelParts?: readonly MechanicTextPart[]
  }[]
}

/** Supplemental rules belong with the explanation rather than the compact Effects value. */
export function skillEffectExplanationDetails(parts: CompactSkillEffectSummaryParts) {
  return (parts.details ?? []).filter(({ label }) => !['Stacks', 'Expiry'].includes(label))
}

export function skillEffectInstantTiming(
  effect: MatureSkillEffectDefinition,
  policy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
  options: ElementalEffectPresentationOptions = {},
): 'Instant' | 'Delayed' | 'Controlled' | undefined {
  const tag = effect.type === 'summon' ? 'summon' : currentCombatEffectTimingTag(effect)
  const mode =
    options.timingMode ??
    (!options.legacyElemental &&
    options.explicitElemental !== false &&
    elementalStatusOverlapsDamage(effect, options.skillEffects) &&
    policy?.modes[tag] === undefined
      ? 'instant'
      : combatEffectTimingMode(policy ?? undefined, tag))
  return mode === 'controlled'
    ? 'Controlled'
    : mode === 'delayed'
      ? 'Delayed'
      : effect.type !== 'damage' && mode === 'instant'
        ? 'Instant'
        : undefined
}

function compactDuration(effect: MatureSkillEffectDefinition): string | null {
  const percentage = isPercentageDotEffect(effect)
  const turns =
    effect.type === 'percentage-recovery'
      ? (effect.ticks ?? 1) > 1
        ? effect.ticks!
        : 0
      : percentage && effect.type === 'bleed'
        ? effect.ticks
        : (effect.durationTurns ??
          (effect.type === 'apply-status'
            ? effect.statusId === 'blindside'
              ? 1
              : effect.statusId === 'suppress'
                ? 2
                : 0
            : 0))
  if (turns <= 0) return null
  return `${turns} ${percentage ? (turns === 1 ? 'turn' : 'turns') : turns === 1 ? 'Turn' : 'Turns'}`
}

function compactMagnitude(
  effect: MatureSkillEffectDefinition,
  magnitude: string | undefined,
): string | null {
  if (effect.type === 'summon' || !magnitude) return null
  if (effect.type === 'apply-status' && /pp Accuracy$/u.test(magnitude))
    return `${magnitude.match(/\d+(?:\.\d+)?/u)![0]}%`
  if (effect.type === 'apply-status' && magnitude.includes('%')) {
    const values = [...new Set(magnitude.match(/\d+(?:\.\d+)?%/gu) ?? [])]
    if (values.length) return values.join(' / ')
  }
  if (effect.type === 'apply-status' && effect.statusId === 'slow') {
    return magnitude.replace(/\/tile$/u, '')
  }
  return magnitude
}

export function compactSkillEffectSummaryParts(
  effect: MatureSkillEffectDefinition,
  timingPolicy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
  options: ElementalEffectPresentationOptions = {},
): CompactSkillEffectSummaryParts {
  const preview = previewEffect(effect, options)
  const timing = skillEffectInstantTiming(effect, timingPolicy, options)
  return {
    label: preview.label,
    target: effectTargetLabel(effect, options.aim),
    magnitude: compactMagnitude(effect, preview.magnitude),
    duration:
      effect.type === 'damage' && !options.legacyElemental && options.explicitElemental !== false
        ? null
        : timing === 'Instant' && /^1 turn$/iu.test(compactDuration(effect) ?? '')
          ? null
          : compactDuration(effect),
    ...(timing ? { timing } : {}),
  }
}

function compactEffectSummary(
  effect: MatureSkillEffectDefinition,
  timingPolicy: SkillEffectTimingPolicy,
  options: ElementalEffectPresentationOptions,
): string {
  const { label, target, magnitude, duration, timing } = compactSkillEffectSummaryParts(
    effect,
    timingPolicy,
    options,
  )
  return [
    label,
    magnitude ? `[${magnitude}]` : null,
    duration ? `[${duration}]` : null,
    timing ? `[${timing}]` : null,
    target ? `[${target}]` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' ')
}

export function skillEffectSummaries(
  skill: Pick<MatureSkillDefinition, 'effects' | 'effectDescriptions'> &
    Partial<Pick<MatureSkillDefinition, 'target'>>,
  timingPolicy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
  options: ElementalEffectPresentationOptions = {},
): readonly string[] {
  return groupSkillEffects(skill.effects, skill.effectDescriptions).map(
    ({ effect, count }) =>
      `${compactEffectSummary(effect, timingPolicy, { ...options, aim: skill.target ?? options.aim, skillEffects: skill.effects })}${count > 1 ? ` ×${count}` : ''}`,
  )
}

export function skillEffectsSummary<Skill extends Pick<MatureSkillDefinition, 'effects'>>(
  skill: Skill,
  timingPolicy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
  options: ElementalEffectPresentationOptions = {},
): string {
  return skillEffectSummaries(skill, timingPolicy, options).join(', ') || 'N/A'
}

export function skillRequirementsSummary(
  skill: Pick<MatureSkillDefinition, 'requirements'>,
): string {
  if (skill.requirements.length === 0) return 'None'
  return skill.requirements.map(skillRequirementDescription).join(', ')
}

export function skillTargetDescription(skill: Pick<MatureSkillDefinition, 'target'>): string {
  if (skill.target.geometryVersion === 3)
    return combatTargetCategories(skill.target)
      .map(
        (category) =>
          ({
            self: 'Self',
            ally: 'Ally',
            enemy: 'Enemy',
            ground: skill.target.kind === 'empty-tile' ? 'Empty Ground' : 'Ground',
          })[category],
      )
      .join(' / ')
  if (skill.target.kind === 'self') return 'Self'
  if (skill.target.kind === 'ground-tile') return 'Ground'
  if (skill.target.kind === 'empty-tile') return 'Empty Ground'
  switch (skill.target.teamPolicy) {
    case 'self':
      return 'Self'
    case 'ally':
      return combatTargetIncludesActor(skill.target) ? 'Self/Ally' : 'Ally'
    case 'enemy':
      return 'Enemy'
    case 'any':
      return 'Any Unit'
  }
}

/** Shared aim and terrain rules remain visible after recipient labels move to each effect. */
function skillDeliveryNotes(
  skill: Pick<MatureSkillDefinition, 'target' | 'effects'>,
  options: { legacyFrozenGround?: boolean; legacyElemental?: boolean; explicitElemental?: boolean },
): string {
  const fire = skill.effects.some((effect) => effect.type === 'damage' && effect.element === 'fire')
  const fireGround =
    fire &&
    !options.legacyElemental &&
    options.explicitElemental !== false &&
    ['unit', 'ground-tile'].includes(skill.target.kind) &&
    skill.target.teamPolicy === 'enemy'
  const terrain = fire
    ? ' · Steam: both teams'
    : skill.effects.some((effect) => effect.type === 'create-terrain')
      ? ` · Frozen Ground: ${options.legacyFrozenGround ? 'both teams' : 'caster’s enemies only'}`
      : ''
  const aim = fireGround ? 'Enemy / Ground' : skillTargetDescription(skill)
  const differs =
    skill.effects.length > 0 &&
    skill.effects.every(
      (effect) =>
        effectTargetLabel(effect, skill.target).replaceAll(' ', '') !== aim.replaceAll(' ', ''),
    )
  return (
    (fireGround || differs ? ` · Aim: ${aim}` : '') +
    effectFriendlyFireNote(skill.effects, skill.target) +
    terrain
  )
}

export function skillTargetMethodDescription(skill: Pick<MatureSkillDefinition, 'target'>): string {
  const kind = skill.target.shape.kind
  return kind === 'all' ? 'All' : `${title(kind)} [${skillCompactRangeDescription(skill)}]`
}

export function skillTargetElevationDescription(
  skill: Pick<MatureSkillDefinition, 'target'>,
): string {
  return skill.target.maximumElevationDifference === null
    ? 'N/A'
    : String(skill.target.maximumElevationDifference)
}

export function skillCompactRangeDescription(skill: Pick<MatureSkillDefinition, 'target'>): string {
  if (skill.target.shape.kind === 'all') return 'N/A'
  return String(skill.target.maximumRange)
}

export function skillLineOfSightDescription(skill: Pick<MatureSkillDefinition, 'target'>): string {
  if (
    skillTargetsOnlySelf(skill.target) ||
    (skill.target.geometryVersion !== 3 && skill.target.shape.kind === 'all')
  )
    return 'N/A'
  return skill.target.requiresLineOfSight ? 'Required' : 'Not required'
}

function skillTargetsOnlySelf(target: MatureSkillDefinition['target']): boolean {
  if (target.geometryVersion !== 3) return target.kind === 'self'
  const categories = combatTargetCategories(target)
  return categories.length === 1 && categories[0] === 'self'
}

export function skillCooldownDescription(
  skill: Pick<MatureSkillDefinition, 'cooldown'>,
  ownerTurns: number | null = skill.cooldown?.ownerTurns ?? null,
): string {
  if (ownerTurns === null) return 'None'
  return `${ownerTurns} ${ownerTurns === 1 ? 'turn' : 'turns'}`
}

function recoveryTiming(ticks: number | undefined): string {
  if (ticks === undefined || ticks <= 1) return ''
  return ` ${ticks} total applications: once when the effect activates, then once at each of the recipient's next ${ticks - 1} end-of-turn boundaries. Amount is per application; recovery cannot revive a defeated unit.`
}

export function skillDisplayName(skill: MatureSkillDefinition): string {
  if (skill.name?.trim()) return skill.name
  const tail = skill.id.includes('.') ? skill.id.slice(skill.id.indexOf('.') + 1) : skill.id
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(tail)) return 'Unnamed Skill'
  return tail
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function skillTargetMethodExplanation(skill: Pick<MatureSkillDefinition, 'target'>): string {
  const shape = skill.target.shape
  if (shape.kind === 'single') return 'Single selects exactly one legal unit or tile.'
  if (shape.kind === 'all') {
    if (skill.target.geometryVersion === 3)
      return 'All covers the battlefield regardless of distance. Authored target categories, elevation and line of sight rules apply.'
    return 'All covers the battlefield regardless of distance or line of sight. Team, friendly fire and authored elevation decide recipients.'
  }
  if (skill.target.geometryVersion !== 2 && skill.target.geometryVersion !== 3)
    return shape.kind === 'circle'
      ? 'Historical Circle spreads around the selected tile.'
      : 'Historical Line ends at the selected tile.'
  if (shape.kind === 'line')
    return `Line length ${shape.length} covers the complete cardinal lane from you, including empty tiles. Combatants do not stop it; authored terrain, line of sight and elevation rules apply.`
  if (skill.target.geometryVersion === 3 && combatTargetCategories(skill.target).includes('self'))
    return `Circle radius ${shape.radius} covers ${(shape.radius * 2 + 1) ** 2 - 1} surrounding tiles from you and includes yourself. Inner rings are included; authored visibility and elevation rules apply to surrounding tiles.`
  return `Circle radius ${shape.radius} covers ${(shape.radius * 2 + 1) ** 2 - 1} surrounding tiles from you, excluding your tile. Inner rings are included. Separately authored self effects still apply.`
}
