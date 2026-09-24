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
    case 'burn':
      return `Apply Burn (Scorched) to ${target}. Burn deals 4, then 3, then 2 fixed damage at the target's next three end-turn boundaries; reapplication restarts the sequence.`
    case 'bleed':
      return `Apply Bleed (Bleeding) to ${target} for ${effect.ticks} ${effect.ticks === 1 ? 'end-turn tick' : 'end-turn ticks'} at ${effect.damagePerTick} damage per tick. Bleed stacks independently up to three times.`
    case 'return-to-turn-start':
      return 'Return to the vacant tile where you started this turn. Root blocks the return. No HP, MP, AP, Movement or past action is refunded.'
    case 'healing':
      return `Restore up to ${effect.amount} HP to ${target}.${recoveryTiming(effect.ticks)}`
    case 'barrier-change':
      return `Grant up to ${effect.amount} Barrier to ${target}.`
    case 'resource-change':
      return `${effect.delta >= 0 ? 'Restore up to' : 'Remove'} ${Math.abs(effect.delta)} MP ${effect.delta >= 0 ? 'to' : 'from'} ${target}.${effect.delta >= 0 ? recoveryTiming(effect.ticks) : ''}`
    case 'copy-statuses':
      return effect.mode === 'amplify'
        ? 'Copy eligible positive active statuses from the selected unit onto yourself. The selected unit keeps its statuses; copied stacks respect caps and remaining durations are not restarted.'
        : 'Copy eligible negative active statuses from yourself onto the selected unit. You keep the original statuses; copied stacks respect caps and remaining durations are not restarted.'
    case 'copy':
      return 'Copy one random eligible regular battle Skill from the selected unit for the rest of this battle. The copied Skill keeps its original MP, targeting, effects and requirements, but costs half AP rounded up.'
    case 'sensory':
      return `Attempt Sensory on ${target}. On a successful hit against Covert, remove eligible positive statuses and Covert, then apply Revealed for ${effect.revealedDurationOwnerTurnStarts} owner-turn starts. Otherwise the Sensory block has no effect.`
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

export function skillTypeDescription(skill: MatureSkillDefinition): string {
  const cockpitTag = skill.tags.find((tag) => tag.startsWith('cockpit:'))
  if (cockpitTag) return title(cockpitTag.slice('cockpit:'.length))
  const fallback = skill.tags.find((tag) =>
    ['attack', 'defense', 'recovery', 'support', 'control'].includes(tag),
  )
  return fallback ? title(fallback) : 'Technique'
}

export function skillCostDescription(skill: MatureSkillDefinition): string {
  return skill.mpCost ? `${skill.apCost} AP / ${skill.mpCost} MP` : `${skill.apCost} AP`
}

export function skillDamageDescription(skill: MatureSkillDefinition): string {
  const amounts = skill.effects
    .filter((effect): effect is Extract<CombatEffectDefinition, { type: 'damage' }> =>
      effect.type === 'damage',
    )
    .map((effect) => effect.amount)

  if (amounts.length === 0) return '0'
  return amounts.length === 1 ? `${amounts[0]} base` : `${amounts.join(' + ')} base`
}

export function skillEffectsSummary(skill: MatureSkillDefinition): string {
  const effects = new Set<string>()

  for (const effect of skill.effects) {
    switch (effect.type) {
      case 'damage':
        if (effect.element) effects.add(title(effect.element))
        break
      case 'apply-status':
        effects.add(gameplayStatusName(effect.statusId))
        break
      case 'remove-status':
        effects.add('Cleanse')
        break
      case 'poison':
        effects.add('Poison')
        break
      case 'burn':
        effects.add('Burn')
        break
      case 'bleed':
        effects.add('Bleed')
        break
      case 'healing':
        effects.add('Healing')
        break
      case 'barrier-change':
        effects.add(effect.amount >= 0 ? 'Barrier' : 'Barrier Break')
        break
      case 'resource-change':
        effects.add(effect.delta >= 0 ? 'MP Restore' : 'MP Drain')
        break
      case 'displace':
        effects.add(effect.direction === 'pull' ? 'Pull' : 'Push')
        break
      case 'create-terrain':
        effects.add('Frozen Terrain')
        break
      case 'return-to-turn-start':
        effects.add('Return to Turn Start')
        break
      case 'copy-statuses':
        effects.add('Status Copy')
        break
      case 'copy':
        effects.add('Skill Copy')
        break
      case 'sensory':
        effects.add('Sensory / Revealed')
        break
    }
  }

  const ignoredTags = new Set([
    'discipline',
    skill.sourceDisciplineId,
    'attack',
    'defense',
    'recovery',
    'support',
    'heal',
    'control',
  ])
  for (const tag of skill.tags) {
    if (tag.startsWith('cockpit:') || ignoredTags.has(tag)) continue
    effects.add(title(tag))
  }

  return effects.size > 0 ? [...effects].join(', ') : 'N/A'
}

export function skillRequirementsSummary(skill: MatureSkillDefinition): string {
  if (skill.requirements.length === 0) return 'None'
  return skill.requirements
    .map((requirement) => {
      switch (requirement.kind) {
        case 'actor-tag-present':
          return `Self: ${title(requirement.tag)}`
        case 'actor-tag-absent':
          return `Self lacks ${title(requirement.tag)}`
        case 'target-tag-present':
          return `Target: ${title(requirement.tag)}`
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

export function skillTargetDescription(skill: MatureSkillDefinition): string {
  if (skill.target.kind === 'self') return 'Self'
  if (skill.target.kind === 'ground-tile') return 'Ground'
  if (skill.target.kind === 'empty-tile') return 'Empty Ground'
  switch (skill.target.teamPolicy) {
    case 'self':
      return 'Self'
    case 'ally':
      return 'Ally'
    case 'enemy':
      return 'Enemy'
    case 'any':
      return 'Any Unit'
  }
}

export function skillTargetMethodDescription(skill: MatureSkillDefinition): string {
  switch (skill.target.shape.kind) {
    case 'single':
      return 'Single'
    case 'circle':
      return `Circle · radius ${skill.target.shape.radius}`
    case 'line':
      return `Line · ${skill.target.shape.length} tiles`
  }
}

export function skillTargetElevationDescription(skill: MatureSkillDefinition): string {
  return skill.target.maximumElevationDifference === null
    ? 'N/A'
    : String(skill.target.maximumElevationDifference)
}

export function skillCompactRangeDescription(skill: MatureSkillDefinition): string {
  if (skill.target.kind === 'self') return 'N/A'
  const { minimumRange: min, maximumRange: max } = skill.target
  return min === max ? `${min} ${min === 1 ? 'tile' : 'tiles'}` : `${min}–${max} tiles`
}

export function skillLineOfSightDescription(skill: MatureSkillDefinition): string {
  if (skill.target.kind === 'self') return 'N/A'
  return skill.target.requiresLineOfSight ? 'Required' : 'Not required'
}

export function skillCooldownDescription(skill: MatureSkillDefinition): string {
  return `${skill.cooldown.ownerTurns} ${skill.cooldown.ownerTurns === 1 ? 'turn' : 'turns'}`
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
