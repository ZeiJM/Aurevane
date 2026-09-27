import { COMBAT_TERRAIN_OVERLAY_DETAILS } from '@aurevane/game-core/combat/terrain-overlays'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import {
  CURRENT_BURN_DAMAGE_BY_STAGE,
  CURRENT_POISON_DAMAGE,
} from '@aurevane/game-core/combat/combat-dots'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'

export interface PreviewEffect {
  label: string
  magnitude?: string
  explanation: string
}

const signed = (value: number) => `${value < 0 ? '−' : '+'}${Math.abs(value)}`

function statusPreview(id: string): PreviewEffect {
  const details = combatStatusDetails(id)
  const status = PV1F_COMBAT_CONTENT.statuses.find((entry) => entry.id === id)
  const result: PreviewEffect = { label: details.name, explanation: details.description }
  // These gameplay-tag rules live in the damage/healing resolvers. Their shared
  // status descriptions are the public authority; avoid a second numeric constant.
  if (['inspired', 'hexed', 'wet', 'conductive'].includes(id)) {
    const percent = details.description.match(/\d+(?:\.\d+)?%/)?.[0]
    if (percent)
      result.magnitude =
        id === 'inspired'
          ? `+${percent} outgoing`
          : id === 'hexed'
            ? `−${percent} healing`
            : `+${percent} Storm`
  } else if (status?.markAccuracyBonusBasisPoints !== undefined) {
    result.magnitude = `+${status.markAccuracyBonusBasisPoints / 100} pp Accuracy`
    result.explanation = `Source gains ${result.magnitude} against this target.`
  } else if (status?.movement?.additionalApPerTile !== undefined) {
    result.magnitude = `${signed(status.movement.additionalApPerTile)} AP/tile`
    result.explanation = details.description
  } else if (status?.movement?.blocked) {
    result.explanation = 'Blocks movement; attacks, Skills and facing remain available.'
  } else if (status?.damageModifiers?.length) {
    result.magnitude = status.damageModifiers
      .map(
        (modifier) =>
          `${signed((modifier.multiplierBasisPoints - 10_000) / 100)}% ${modifier.direction}`,
      )
      .join(' / ')
    result.explanation = details.description.split('. ')[0] + '.'
  } else if (status && status.damageTakenMultiplierBasisPoints !== 10_000) {
    result.magnitude = `${signed((status.damageTakenMultiplierBasisPoints - 10_000) / 100)}% incoming${status.maximumStacks > 1 ? '/stack' : ''}`
    result.explanation = `Recipient takes ${result.magnitude}.${status.maximumStacks > 1 ? ` Up to ${status.maximumStacks} stacks.` : ''}`
  } else if (status?.endOfTurn) {
    result.magnitude = `${status.endOfTurn.amount} × ${status.durationOwnerTurnStarts} ticks`
  }
  return result
}

export function previewEffect(effect: CombatEffectDefinition): PreviewEffect {
  const target =
    effect.recipient === 'actor'
      ? 'you'
      : effect.recipient === 'affected-units'
        ? 'each affected unit'
        : 'the target'
  switch (effect.type) {
    case 'damage':
      return {
        label: 'Dmg',
        magnitude: String(effect.amount),
        explanation: `Deals base${effect.element ? ` ${effect.element}` : ''} damage before Power, Level and defenses.${effect.facingModifiersBasisPoints ? ` Facing: front ${effect.facingModifiersBasisPoints.front / 100}%, side ${effect.facingModifiersBasisPoints.side / 100}%, rear ${effect.facingModifiersBasisPoints.rear / 100}%.` : ''}`,
      }
    case 'healing':
      return {
        label: 'Healing',
        magnitude: String(effect.amount),
        explanation: `Restores HP to ${target}${effect.ticks && effect.ticks > 1 ? ` per application, ${effect.ticks} times (first immediately)` : ''}.`,
      }
    case 'barrier-change':
      return {
        label: 'Barrier',
        magnitude: String(effect.amount),
        explanation: `Grants damage-absorbing Barrier to ${target}.`,
      }
    case 'resource-change':
      return {
        label: effect.delta < 0 ? 'MP Drain' : 'MP Restore',
        magnitude: String(Math.abs(effect.delta)),
        explanation:
          effect.delta < 0
            ? `Removes MP from ${target}.`
            : `Restores MP to ${target}${effect.ticks && effect.ticks > 1 ? ` per application, ${effect.ticks} times (first immediately)` : ''}.`,
      }
    case 'apply-status':
      return statusPreview(effect.statusId)
    case 'displace':
      return {
        label: effect.direction === 'pull' ? 'Pull' : 'Push',
        magnitude: `${effect.distance} ${effect.distance === 1 ? 'tile' : 'tiles'}`,
        explanation: `Moves ${target} ${effect.direction === 'pull' ? 'toward you' : 'away'}; stops at blocked tiles or Root.`,
      }
    case 'burn':
      return {
        label: 'Burn',
        magnitude: CURRENT_BURN_DAMAGE_BY_STAGE.join('/'),
        explanation: 'Fixed damage at the next three turn ends; reapplication restarts it.',
      }
    case 'bleed':
      return {
        label: 'Bleed',
        magnitude: `${effect.damagePerTick} × ${effect.ticks} ticks`,
        explanation: 'Fixed damage at turn end; up to three independent stacks.',
      }
    case 'poison':
      return {
        label: 'Poison',
        magnitude: String(CURRENT_POISON_DAMAGE),
        explanation:
          'Fixed damage at turn end and every five voluntarily entered tiles, until removed.',
      }
    case 'remove-status':
      return {
        label: effect.statusIds.every((id) => combatStatusDetails(id).kind === 'Buff')
          ? 'Dispel'
          : 'Cleanse',
        explanation: `Removes ${effect.statusIds.map((id) => combatStatusDetails(id).name).join(', ')}.`,
      }
    case 'create-terrain':
      return {
        label: 'Frozen Terrain',
        magnitude: `+${COMBAT_TERRAIN_OVERLAY_DETAILS.frozen.additionalApPerTile} AP/tile`,
        explanation: 'Both teams pay extra movement AP; fire turns it into sight-blocking Steam.',
      }
    case 'return-to-turn-start':
      return {
        label: 'Return',
        explanation: 'Returns you to your turn-start tile if legal; refunds no resources.',
      }
    case 'copy-statuses':
      return {
        label: effect.mode === 'amplify' ? 'Amplify' : 'Curse',
        explanation:
          effect.mode === 'amplify'
            ? 'Copies eligible positive statuses from the target to you.'
            : 'Copies eligible negative statuses from you to the target.',
      }
    case 'copy':
      return {
        label: 'Skill Copy',
        explanation: 'Copies one eligible enemy Skill for this battle at half AP, rounded up.',
      }
    case 'sensory':
      return {
        label: 'Sensory',
        explanation: 'On a hit against Covert, strips eligible buffs and applies Revealed.',
      }
  }
}

export function skillPreviewEffects(skill: MatureSkillDefinition): readonly PreviewEffect[] {
  const unique = new Map<string, PreviewEffect>()
  for (const effect of skill.effects) {
    const entry = previewEffect(effect)
    // Hits retain their amounts/count in the summary; explain each effect only once.
    unique.set(`${entry.label}:${entry.explanation}`, entry)
  }
  return [...unique.values()]
}

export function effectSummary(effect: PreviewEffect): string {
  return effect.magnitude === undefined ? effect.label : `${effect.label} [${effect.magnitude}]`
}
