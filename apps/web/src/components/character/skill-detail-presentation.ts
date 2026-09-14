import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
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
      return `${effect.direction === 'pull' ? 'Pull' : 'Push'} ${target} up to ${effect.distance} ${effect.distance === 1 ? 'tile' : 'tiles'} ${effect.direction === 'pull' ? 'toward you' : 'away'}, one legal tile at a time. Stops before occupied, blocked or illegal-elevation tiles. Pull never enters your tile. Root prevents displacement. Failure grants no refund.`
    case 'poison':
      return `Apply Poison (Poisoned) to ${target}.`
    case 'bleed':
      return `Apply Bleed (Bleeding) to ${target} for ${effect.ticks} ${effect.ticks === 1 ? 'end-turn tick' : 'end-turn ticks'} at ${effect.damagePerTick} damage per tick. Bleed stacks independently up to three times.`
    case 'return-to-turn-start':
      return 'Return to the vacant tile where you started this turn. Root blocks the return. No HP, MP, AP, Movement or past action is refunded.'
    case 'healing':
      return `Restore up to ${effect.amount} HP to ${target}.${recoveryTiming(effect.ticks)}`
    case 'resource-change':
      return `${effect.delta >= 0 ? 'Restore up to' : 'Remove'} ${Math.abs(effect.delta)} MP ${effect.delta >= 0 ? 'to' : 'from'} ${target}.${effect.delta >= 0 ? recoveryTiming(effect.ticks) : ''}`
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
  return combatActionPresentationTags(skill)
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

function recoveryTiming(ticks: number | undefined): string {
  if (ticks === undefined || ticks <= 1) return ''
  return ` ${ticks} total applications: once immediately, then once at each of the recipient's next ${ticks - 1} end-of-turn boundaries. Amount is per application; recovery cannot revive a defeated unit.`
}

export function skillDisplayName(skill: MatureSkillDefinition): string {
  const tail = skill.id.includes('.') ? skill.id.slice(skill.id.indexOf('.') + 1) : skill.id
  return tail
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
