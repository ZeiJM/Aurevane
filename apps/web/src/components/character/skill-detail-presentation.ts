import { gameplayStatusName } from '../../lib/battle/combat-interaction-presentation'
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
      const element =
        effect.element === 'storm'
          ? ' Storm gains a single 20% bonus against Wet or Conductive once per recipient per command, within the damage cap, and consumes Conductive; Wet remains.'
          : effect.element === 'fire'
            ? ' Positive fire damage removes Wet and Frozen from units. Fire on affected Frozen tiles replaces them with Steam for two round boundaries, blocking line of sight for both teams.'
            : ''
      return `Deal ${effect.amount} base damage to ${target}.${position}${element}`
    }
    case 'create-terrain':
      return 'Create Frozen terrain on affected tiles for two round boundaries. Both teams pay 10 extra AP per entered tile; Airborne ignores this surcharge. Fire converts Frozen to Steam, which blocks line of sight.'
    case 'displace':
      return `Push ${target} one tile away if the destination is vacant, passable and within legal elevation. Root prevents displacement. Failure grants no refund.`
    case 'return-to-turn-start':
      return 'Return to the vacant tile where you started this turn. Root blocks the return. No HP, MP, AP, Movement or past action is refunded.'
    case 'healing':
      return `Restore up to ${effect.amount} HP to ${target}.`
    case 'resource-change':
      return `${effect.delta >= 0 ? 'Restore up to' : 'Remove'} ${Math.abs(effect.delta)} MP ${effect.delta >= 0 ? 'to' : 'from'} ${target}.`
    case 'remove-status':
      return `Remove ${effect.statusIds.map((id) => combatStatusDetails(id).name).join(', ')} from ${target}.`
    case 'apply-status': {
      const status = combatStatusDetails(effect.statusId)
      return `Apply ${effect.stacks} ${gameplayStatusName(effect.statusId)} ${effect.stacks === 1 ? 'stack' : 'stacks'} to ${target}. ${status.description} ${combatStatusDuration(effect.statusId)}`
    }
  }
}

export function skillRequirementDescription(requirement: CombatUseRequirement): string {
  switch (requirement.kind) {
    case 'actor-tag-present':
      return `Requires ${requirement.tag} on yourself.`
    case 'actor-tag-absent':
      return `Requires no ${requirement.tag} on yourself.`
    case 'target-tag-present':
      return `Target must have ${requirement.tag}.`
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
                  : effect.type === 'return-to-turn-start'
                    ? 'Return to start'
                    : effect.type === 'create-terrain'
                      ? 'Frozen terrain'
                      : effect.type === 'displace'
                        ? 'Push one tile'
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
  const terrain = skill.effects.some(
    (effect) =>
      effect.type === 'create-terrain' || (effect.type === 'damage' && effect.element === 'fire'),
  )
    ? '. Terrain affects both teams; unit effects follow the listed recipients'
    : ''
  const resonance =
    skill.target.kind === 'ground-tile' || skill.target.kind === 'empty-tile'
      ? '. Unit-targeted Resonance payoffs require a unit selection; ground selection leaves that setup armed'
      : ''
  return unitAffectedDescription(skill) + terrain + resonance
}

function unitAffectedDescription(skill: MatureSkillDefinition): string {
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
