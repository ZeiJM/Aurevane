import { previewEffect } from './skill-effect-preview'
import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
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

function title(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function recipient(effect: MatureSkillEffectDefinition): string {
  if (effect.recipient === 'actor') return 'yourself'
  if (effect.recipient === 'affected-units') return 'each affected unit'
  if (effect.recipient === 'selected-tile') return 'the selected empty tile'
  return 'the selected unit'
}

export function skillEffectDescription(effect: MatureSkillEffectDefinition): string {
  const target = recipient(effect)
  switch (effect.type) {
    case 'summon':
      return 'Summon the authored allied unit onto the selected empty tile.'
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
    case 'remove-status': {
      const statusNames = [...new Set(effect.statusIds.map((id) => combatStatusDetails(id).name))]
      return `Remove ${statusNames.join(', ')} from ${target}.`
    }
    case 'apply-status': {
      const status = combatStatusDetails(effect.statusId)
      const preview = previewEffect(effect)
      const duration =
        (effect.durationTurns ?? 0) > 0
          ? `Lasts ${effect.durationTurns} ${effect.durationTurns === 1 ? 'turn' : 'turns'}.`
          : combatStatusDuration(effect.statusId)
      const explanation =
        effect.potencyBasisPoints !== undefined
          ? `${preview.explanation}${effect.statusId === 'mark' ? ' Other attackers gain no benefit.' : ''}`
          : status.description
      return `Apply ${effect.stacks} ${gameplayStatusName(effect.statusId)} ${effect.stacks === 1 ? 'stack' : 'stacks'} to ${target}. ${explanation} ${duration}`
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
  const tags = combatActionPresentationTags({
    target: skill.target,
    effects: skill.effects.filter(isMaterializedCombatEffect),
  })
  return skill.effects.some((effect) => effect.type === 'summon') ? [...tags, 'Summon'] : tags
}

export function skillTypeDescription(
  skill: MatureSkillDefinition,
): 'Attack' | 'Recovery' | 'Utility' {
  if (skill.tags.includes('attack')) return 'Attack'

  const recoversHpOrMp = skill.effects.some(
    (effect) =>
      effect.type === 'healing' || (effect.type === 'resource-change' && effect.delta > 0),
  )
  return recoversHpOrMp ? 'Recovery' : 'Utility'
}

export function skillCostDescription(skill: MatureSkillDefinition): string {
  return skill.mpCost ? `${skill.apCost} AP / ${skill.mpCost} MP` : `${skill.apCost} AP`
}

export interface CompactSkillEffectSummaryParts {
  label: string
  magnitude: string | null
  duration: string | null
}

function compactDuration(effect: MatureSkillEffectDefinition): string | null {
  const turns = effect.durationTurns ?? 0
  if (turns <= 0) return null
  return `${turns} ${turns === 1 ? 'Turn' : 'Turns'}`
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
): CompactSkillEffectSummaryParts {
  const preview = previewEffect(effect)
  return {
    label: preview.label,
    magnitude: compactMagnitude(effect),
    duration: compactDuration(effect),
  }
}

function compactEffectSummary(effect: MatureSkillEffectDefinition): string {
  const { label, magnitude, duration } = compactSkillEffectSummaryParts(effect)
  return [label, magnitude ? `[${magnitude}]` : null, duration ? `[${duration}]` : null]
    .filter((part): part is string => part !== null)
    .join(' ')
}

export function skillEffectSummaries(skill: MatureSkillDefinition): readonly string[] {
  return skill.effects.map(compactEffectSummary)
}

export function skillEffectsSummary(skill: MatureSkillDefinition): string {
  return skillEffectSummaries(skill).join(', ') || 'N/A'
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
      return 'Circle'
    case 'line':
      return 'Line'
  }
}

export function skillTargetElevationDescription(skill: MatureSkillDefinition): string {
  return skill.target.maximumElevationDifference === null
    ? 'N/A'
    : String(skill.target.maximumElevationDifference)
}

export function skillCompactRangeDescription(skill: MatureSkillDefinition): string {
  if (skill.target.kind === 'self') return 'N/A'
  return String(skill.target.maximumRange)
}

export function skillLineOfSightDescription(skill: MatureSkillDefinition): string {
  if (skill.target.kind === 'self') return 'N/A'
  return skill.target.requiresLineOfSight ? 'Required' : 'Not required'
}

export function skillCooldownDescription(skill: MatureSkillDefinition): string {
  if (skill.cooldown === null) return 'None'
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
