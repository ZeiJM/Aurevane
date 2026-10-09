import { groupSkillEffects } from './skill-effect-groups'
import {
  isPercentageDotEffect,
  percentageDotDescription,
} from '@aurevane/game-core/combat/combat-percentage-dots'
import { skillInformationRows } from './skill-information-contract'
import { previewEffect, skillDamageElementInteraction } from './skill-effect-preview'
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
    legacyElemental?: boolean
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
      return `Rewind to the ${effect.anchorMode === 'cast-position' ? 'tile captured when cast' : 'vacant tile where you started this turn'}. Rooted blocks the return. No HP, MP, AP, Movement or past action is refunded.`
    case 'percentage-recovery':
      return previewEffect(effect, options).explanation
    case 'healing':
      return `Restore up to ${effect.amount} HP to ${target}.${recoveryTiming(effect.ticks)}`
    case 'barrier-change':
      return `Grant up to ${effect.amount} Barrier to ${target}.`
    case 'resource-change':
      return `${effect.delta >= 0 ? 'Restore up to' : 'Remove'} ${Math.abs(effect.delta)} MP ${effect.delta >= 0 ? 'to' : 'from'} ${target}.${effect.delta >= 0 ? recoveryTiming(effect.ticks) : ''}`
    case 'copy-statuses':
      return effect.mode === 'amplify'
        ? 'Copy eligible positive active statuses from the selected unit onto yourself. The selected unit keeps its statuses; remaining durations are not restarted.'
        : 'Copy eligible negative active statuses from yourself onto the selected unit. You keep the original statuses; remaining durations are not restarted.'
    case 'sensory':
      return `Attempt Reveal on ${target}. On a successful hit against Covert, remove eligible positive statuses and Covert, then apply Revealed for ${effect.revealedDurationOwnerTurnStarts} owner-turn starts. Otherwise Reveal has no effect.`
    case 'remove-status': {
      const statusIds = combatEffectPresentationTags(effect).includes('Cleanse')
        ? [...effect.statusIds, 'suppress']
        : effect.statusIds
      const statusNames = [...new Set(statusIds.map((id) => combatStatusDetails(id).name))]
      return `Remove ${statusNames.join(', ')} from ${target}.`
    }
    case 'apply-status': {
      if (effect.statusId === 'suppress')
        return `Apply Suppress to ${target}. ${previewEffect(effect, options).explanation} Lasts ${effect.durationTurns ?? 2} turns.`
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
      return `Requires ${requirementTagName(requirement.tag)} on yourself.`
    case 'actor-tag-absent':
      return `Requires no ${requirementTagName(requirement.tag)} on yourself.`
    case 'target-tag-present':
      return `Target must have ${requirementTagName(requirement.tag)}.`
    case 'actor-status-present':
      return `Requires ${gameplayStatusName(requirement.statusId)} on yourself.`
    case 'actor-status-absent':
      return `Requires no ${gameplayStatusName(requirement.statusId)} on yourself.`
    case 'target-status-present':
      return `Target must have ${gameplayStatusName(requirement.statusId)}.`
    case 'actor-hp-at-most':
      return `Requires your HP at ${requirement.basisPoints / 100}% or below.`
  }
}

export function skillTargetTags(skill: MatureSkillDefinition): readonly string[] {
  return combatActionPresentationTags({
    target: skill.target,
    effects: skill.effects.filter(isMaterializedCombatEffect),
  })
}

export function skillTypeDescription(
  skill: Pick<MatureSkillDefinition, 'tags' | 'effects'>,
): 'Attack' | 'Recovery' | 'Utility' {
  if (skill.tags.includes('attack')) return 'Attack'

  const recoversHpOrMp = skill.effects.some(
    (effect) =>
      effect.type === 'percentage-recovery' ||
      effect.type === 'healing' ||
      (effect.type === 'resource-change' && effect.delta > 0),
  )
  return recoversHpOrMp ? 'Recovery' : 'Utility'
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
  skill: Pick<MatureSkillDefinition, 'apCost' | 'mpCost'>,
): string {
  return skill.mpCost ? `${skill.apCost} AP / ${skill.mpCost} MP` : `${skill.apCost} AP`
}

/** Parameter order and wording shared by Nexus and committed battle Skills. */
export function skillParameterRows(
  skill: Pick<
    MatureSkillDefinition,
    'tags' | 'effects' | 'apCost' | 'mpCost' | 'cooldown' | 'requirements' | 'target'
  >,
  costs: Pick<MatureSkillDefinition, 'apCost' | 'mpCost'> & {
    cooldownOwnerTurns?: number | null
  } = skill,
  timingPolicy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
  options: {
    legacyFrozenGround?: boolean
    airborneAttackElevation?: boolean
    legacyElemental?: boolean
  } = {},
): readonly (readonly [string, string])[] {
  return skillInformationRows({
    'Skill Type': skillParameterTypeDescription(skill),
    Cost: skillCostDescription({ ...skill, ...costs }),
    Cooldown: skillCooldownDescription(skill, costs.cooldownOwnerTurns),
    Requirements: skillRequirementsSummary(skill),
    Effects: skillEffectsSummary(skill, timingPolicy),
    Range: skillCompactRangeDescription(skill),
    Target:
      skillTargetRecipientDescription(skill, options.legacyFrozenGround) +
      (!options.legacyElemental &&
      skill.target.kind === 'unit' &&
      skill.target.teamPolicy === 'enemy' &&
      skill.effects.some((effect) => effect.type === 'damage' && effect.element === 'fire')
        ? ' / Ground'
        : ''),
    'Target Method': skillTargetMethodDescription(skill),
    'Target Elevation':
      options.airborneAttackElevation && skill.tags.includes('attack')
        ? '3'
        : skillTargetElevationDescription(skill),
    'Line of Sight': skillLineOfSightDescription(skill),
  })
}

export interface CompactSkillEffectSummaryParts {
  label: string
  magnitude: string | null
  duration: string | null
  timing?: 'Instant' | 'Delayed'
}

export function skillEffectInstantTiming(
  effect: MatureSkillEffectDefinition,
  policy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
): 'Instant' | 'Delayed' | undefined {
  const tag = effect.type === 'summon' ? 'summon' : currentCombatEffectTimingTag(effect)
  const mode = combatEffectTimingMode(policy ?? undefined, tag)
  return mode === 'delayed'
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

function compactMagnitude(effect: MatureSkillEffectDefinition): string | null {
  if (effect.type === 'summon') return null
  if (effect.type === 'apply-status' && effect.potencyBasisPoints !== undefined) {
    return `${Math.abs(effect.potencyBasisPoints) / 100}%`
  }

  const magnitude = previewEffect(effect).magnitude
  if (!magnitude) return null
  if (effect.type === 'apply-status' && effect.statusId === 'slow') {
    return magnitude.replace(/\/tile$/u, '')
  }
  return magnitude
}

export function compactSkillEffectSummaryParts(
  effect: MatureSkillEffectDefinition,
  timingPolicy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
): CompactSkillEffectSummaryParts {
  const preview = previewEffect(effect)
  const timing = skillEffectInstantTiming(effect, timingPolicy)
  return {
    label: preview.label,
    magnitude: compactMagnitude(effect),
    duration: compactDuration(effect),
    ...(timing ? { timing } : {}),
  }
}

function compactEffectSummary(
  effect: MatureSkillEffectDefinition,
  timingPolicy: SkillEffectTimingPolicy,
): string {
  const { label, magnitude, duration, timing } = compactSkillEffectSummaryParts(
    effect,
    timingPolicy,
  )
  return [
    label,
    magnitude ? `[${magnitude}]` : null,
    duration ? `[${duration}]` : null,
    timing ? `[${timing}]` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' ')
}

export function skillEffectSummaries(
  skill: Pick<MatureSkillDefinition, 'effects' | 'effectDescriptions'>,
  timingPolicy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
): readonly string[] {
  return groupSkillEffects(skill.effects, skill.effectDescriptions).map(
    ({ effect, count }) =>
      `${compactEffectSummary(effect, timingPolicy)}${count > 1 ? ` ×${count}` : ''}`,
  )
}

export function skillEffectsSummary<Skill extends Pick<MatureSkillDefinition, 'effects'>>(
  skill: Skill,
  timingPolicy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
): string {
  return skillEffectSummaries(skill, timingPolicy).join(', ') || 'N/A'
}

export function skillRequirementsSummary(
  skill: Pick<MatureSkillDefinition, 'requirements'>,
): string {
  if (skill.requirements.length === 0) return 'None'
  return skill.requirements
    .map((requirement) => {
      switch (requirement.kind) {
        case 'actor-tag-present':
          return `Self: ${requirementTagName(requirement.tag)}`
        case 'actor-tag-absent':
          return `Self lacks ${requirementTagName(requirement.tag)}`
        case 'target-tag-present':
          return `Target: ${requirementTagName(requirement.tag)}`
        case 'actor-status-present':
          return `Self: ${gameplayStatusName(requirement.statusId)}`
        case 'actor-status-absent':
          return `Self lacks ${gameplayStatusName(requirement.statusId)}`
        case 'target-status-present':
          return `Target: ${gameplayStatusName(requirement.statusId)}`
        case 'actor-hp-at-most':
          return `HP ≤ ${requirement.basisPoints / 100}%`
      }
    })
    .join(', ')
}

export function skillTargetDescription(skill: Pick<MatureSkillDefinition, 'target'>): string {
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

/** Include affected recipients only when they differ from the selected target policy. */
function skillTargetRecipientDescription(
  skill: Pick<MatureSkillDefinition, 'target' | 'effects'>,
  legacyFrozenGround = false,
): string {
  const target = skillTargetDescription(skill)
  const { kind, teamPolicy, friendlyFire } = skill.target
  const recipientsMatch =
    (kind === 'self' && friendlyFire === 'allies-only') ||
    (kind === 'unit' &&
      ((teamPolicy === 'enemy' && friendlyFire === 'enemies-only') ||
        (teamPolicy === 'ally' && friendlyFire === 'allies-only') ||
        (teamPolicy === 'self' && friendlyFire === 'allies-only') ||
        (teamPolicy === 'any' && friendlyFire === 'all-units')))
  const recipients = recipientsMatch ? '' : ` · ${unitAffectedDescription(skill)}`
  const terrain = skill.effects.some(
    (effect) => effect.type === 'damage' && effect.element === 'fire',
  )
    ? ' · Steam: both teams'
    : skill.effects.some((effect) => effect.type === 'create-terrain')
      ? ` · Frozen Ground: ${legacyFrozenGround ? 'both teams' : 'caster’s enemies only'}`
      : ''
  return target + recipients + terrain
}

export function skillTargetMethodDescription(skill: Pick<MatureSkillDefinition, 'target'>): string {
  switch (skill.target.shape.kind) {
    case 'all':
      return 'All'
    case 'single':
      return 'Single'
    case 'circle':
      return `Circle [${skill.target.shape.radius}]`
    case 'line':
      return `Line [${skill.target.shape.length}]`
  }
}

export function skillTargetElevationDescription(
  skill: Pick<MatureSkillDefinition, 'target'>,
): string {
  return skill.target.maximumElevationDifference === null
    ? 'N/A'
    : String(skill.target.maximumElevationDifference)
}

export function skillCompactRangeDescription(skill: Pick<MatureSkillDefinition, 'target'>): string {
  if (skill.target.kind === 'self' || skill.target.shape.kind === 'all') return 'N/A'
  return String(skill.target.maximumRange)
}

export function skillLineOfSightDescription(skill: Pick<MatureSkillDefinition, 'target'>): string {
  if (skill.target.kind === 'self' || skill.target.shape.kind === 'all') return 'N/A'
  return skill.target.requiresLineOfSight ? 'Required' : 'Not required'
}

export function skillCooldownDescription(
  skill: Pick<MatureSkillDefinition, 'cooldown'>,
  ownerTurns: number | null = skill.cooldown?.ownerTurns ?? null,
): string {
  if (ownerTurns === null) return 'None'
  return `${ownerTurns} ${ownerTurns === 1 ? 'turn' : 'turns'}`
}

function unitAffectedDescription(skill: Pick<MatureSkillDefinition, 'target'>): string {
  switch (skill.target.friendlyFire) {
    case 'enemies-only':
      return 'Enemies only'
    case 'allies-only':
      return skill.target.kind === 'self' ? 'Yourself' : 'Allies only'
    case 'all-units':
      return 'All units, including allies'
    case 'all-except-actor':
      return 'All units except yourself, including allies'
  }
}

function recoveryTiming(ticks: number | undefined): string {
  if (ticks === undefined || ticks <= 1) return ''
  return ` ${ticks} total applications: once when the effect activates, then once at each of the recipient's next ${ticks - 1} end-of-turn boundaries. Amount is per application; recovery cannot revive a defeated unit.`
}

export function skillDisplayName(skill: MatureSkillDefinition): string {
  const tail = skill.id.includes('.') ? skill.id.slice(skill.id.indexOf('.') + 1) : skill.id
  return tail
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function skillTargetMethodExplanation(skill: Pick<MatureSkillDefinition, 'target'>): string {
  const shape = skill.target.shape
  if (shape.kind === 'single') return 'Single selects exactly one legal unit or tile.'
  if (shape.kind === 'all')
    return 'All covers the battlefield regardless of distance or line of sight. Team, friendly fire and authored elevation decide recipients.'
  if (skill.target.geometryVersion !== 2)
    return shape.kind === 'circle'
      ? 'Historical Circle spreads around the selected tile.'
      : 'Historical Line ends at the selected tile.'
  if (shape.kind === 'line')
    return `Line [${shape.length}] covers the complete cardinal lane from you, including empty tiles. Combatants do not stop it; authored terrain, line of sight and elevation rules apply.`
  return `Circle [${shape.radius}] covers ${(shape.radius * 2 + 1) ** 2 - 1} surrounding tiles from you, excluding your tile. Inner rings are included. Separately authored self effects still apply.`
}
