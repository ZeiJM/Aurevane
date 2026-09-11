import {
  combatStatusDetails,
  combatStatusDuration,
} from '@aurevane/game-core/combat/status-content'
import type {
  CombatEffectDefinition,
  CombatUseRequirement,
} from '@aurevane/game-core/combat/actions'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'

function title(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function recipient(effect: CombatEffectDefinition): string {
  if (effect.recipient === 'actor') return 'yourself'
  if (effect.recipient === 'affected-units') return 'each affected unit'
  return 'the selected unit'
}

export function skillEffectDescription(effect: CombatEffectDefinition): string {
  const target = recipient(effect)
  switch (effect.type) {
    case 'damage': {
      const facing = effect.facingModifiersBasisPoints
      const position = facing
        ? ` Facing: front ${facing.front / 100}%, side ${facing.side / 100}%, rear ${facing.rear / 100}%.`
        : ''
      return `Deal ${effect.amount} base damage to ${target}.${position}`
    }
    case 'healing':
      return `Restore up to ${effect.amount} HP to ${target}.`
    case 'resource-change':
      return `${effect.delta >= 0 ? 'Restore up to' : 'Remove'} ${Math.abs(effect.delta)} MP ${effect.delta >= 0 ? 'to' : 'from'} ${target}.`
    case 'remove-status':
      return `Remove ${effect.statusIds.map((id) => combatStatusDetails(id).name).join(', ')} from ${target}.`
    case 'apply-status': {
      const status = combatStatusDetails(effect.statusId)
      return `Apply ${effect.stacks} ${status.name} ${effect.stacks === 1 ? 'stack' : 'stacks'} to ${target}. ${status.description} ${combatStatusDuration(effect.statusId)}`
    }
  }
}

export function skillRequirementDescription(requirement: CombatUseRequirement): string {
  switch (requirement.kind) {
    case 'actor-status-present':
      return `Requires ${title(requirement.statusId)} on yourself.`
    case 'actor-status-absent':
      return `Requires no ${title(requirement.statusId)} on yourself.`
    case 'target-status-present':
      return `Target must have ${title(requirement.statusId)}.`
    case 'actor-hp-at-most':
      return `Requires your HP at ${requirement.basisPoints / 100}% or below.`
  }
}

export function skillTargetTags(skill: MatureSkillDefinition): readonly string[] {
  const { target } = skill
  const kind =
    target.kind === 'self'
      ? 'Self'
      : target.kind === 'ground-tile'
        ? 'Ground tile'
        : target.kind === 'empty-tile'
          ? 'Empty tile'
          : target.teamPolicy === 'enemy'
            ? 'Enemy'
            : target.teamPolicy === 'ally'
              ? target.minimumRange === 0
                ? 'Self or ally'
                : 'Ally'
              : 'Any unit'
  const shape =
    target.shape.kind === 'single'
      ? 'Single target'
      : target.shape.kind === 'circle'
        ? `Area · radius ${target.shape.radius}`
        : `Line · ${target.shape.length} tiles`
  const effectTags = [
    ...new Set(
      skill.effects.map((effect) => {
        const label =
          effect.type === 'damage'
            ? 'Damage'
            : effect.type === 'healing'
              ? 'Healing'
              : effect.type === 'resource-change'
                ? effect.delta < 0
                  ? 'MP Drain'
                  : 'MP Restore'
                : effect.type === 'remove-status'
                  ? 'Cleanse'
                  : combatStatusDetails(effect.statusId).name
        return `${label}${effect.recipient === 'actor' && skill.target.kind !== 'self' ? ' · Self' : ''}`
      }),
    ),
  ]
  return [kind, shape, ...effectTags]
}

export function skillRangeDescription(skill: MatureSkillDefinition): string {
  const { minimumRange: min, maximumRange: max } = skill.target
  return skill.target.kind === 'self'
    ? 'Self only'
    : min === max
      ? `${min} ${min === 1 ? 'tile' : 'tiles'}`
      : `${min}–${max} tiles`
}

export function skillAffectedDescription(skill: MatureSkillDefinition): string {
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
