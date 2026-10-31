import { attackTagDescription } from '@aurevane/game-core/combat/combat-attack-tags'
import {
  isReversalPresentationEffect,
  reversalDescription,
  reversalMagnitude,
} from '../../lib/reversal-presentation'
import type { CombatStatusTuning } from '@aurevane/game-core/combat/actions'
import { endureDescription } from '../../lib/combat-effect-descriptions'
import {
  selectableCombatStatusIds,
  combatStatusSelectionSummary,
} from '@aurevane/game-core/combat/combat-status-selection'
import {
  resolvedCombatEffectTagPresentation,
  type CombatTagPresentationSnapshot,
} from '@aurevane/game-core/combat/combat-tag-registry'
import { isCleanseChilledEffect } from '@aurevane/game-core/combat/combat-cleanse'
import {
  combatEffectTimingMode,
  defaultCombatEffectTimingPolicy,
  type CombatEffectTimingPolicy,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { groupSkillEffects } from './skill-effect-groups'
import {
  isPercentageDotEffect,
  percentageDotDescription,
  percentageDotMagnitude,
} from '@aurevane/game-core/combat/combat-percentage-dots'
import { COMBAT_TERRAIN_OVERLAY_DETAILS } from '@aurevane/game-core/combat/terrain-overlays'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import { combatEffectPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import {
  blindsideDamageDescription,
  blindsideDebuffDescription,
  BLINDSIDE_DEBUFF_STATUS_ID,
  DEFAULT_BLINDSIDE_MODIFIERS,
} from '@aurevane/game-core/combat/combat-blindside'
import { counterDescription } from '@aurevane/game-core/combat/combat-counter'
import { airborneDescription } from '@aurevane/game-core/combat/combat-airborne'
import {
  CURRENT_BURN_DAMAGE_BY_STAGE,
  CURRENT_POISON_DAMAGE,
} from '@aurevane/game-core/combat/combat-dots'
import type {
  MatureSkillDefinition,
  MatureSkillEffectDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  statusDamageMultiplierBasisPoints,
  statusPotencyDescription,
} from '../../lib/status-potency-presentation'

export interface PreviewEffect {
  tagPresentation?: CombatTagPresentationSnapshot
  label: string
  magnitude?: string
  explanation: string
}

const signed = (value: number) => `${value < 0 ? '−' : '+'}${Math.abs(value)}`

/** Recipient selectors may overlap at cast time; descriptions keep that condition explicit. */
export function elementalStatusOverlapsDamage(
  effect: MatureSkillEffectDefinition,
  skillEffects: readonly MatureSkillEffectDefinition[] = [],
): boolean {
  if (effect.type !== 'apply-status' || effect.applicationOrigin === 'frozen-ground') return false
  const element = ({ frozen: 'ice', wet: 'water', conductive: 'storm' } as Record<string, string>)[
    effect.statusId
  ]
  return (
    Boolean(element) &&
    skillEffects.some(
      (candidate) =>
        candidate.type === 'damage' &&
        candidate.element === element &&
        (candidate.recipient === effect.recipient ||
          (candidate.recipient !== 'actor' && effect.recipient !== 'actor')),
    )
  )
}

/** Shared by compact popups and expanded reports; describes existing combat rules. */
export function skillDamageElementInteraction(
  effect: MatureSkillEffectDefinition,
  legacyElemental = false,
  timingPolicy?: CombatEffectTimingPolicy | null,
  skillEffects?: readonly MatureSkillEffectDefinition[],
  explicitElemental = true,
): string {
  if (effect.type !== 'damage') return ''
  if (!legacyElemental && explicitElemental) {
    if (effect.element === 'fire')
      return ' Fire converts affected Frozen Ground to Steam mist, keeping its remaining life and blocking sight for both teams.'
    if (effect.element === 'storm')
      return ' Storm uses active Drenched and Conductive bonuses and consumes the old Conductive charge; Drenched remains.'
    return ''
  }
  if (!legacyElemental) {
    const statusId = ({ ice: 'frozen', water: 'wet', storm: 'conductive' } as const)[
      effect.element as 'ice' | 'water' | 'storm'
    ]
    if (statusId && skillEffects) {
      // Static readers have no resolved cast identities. Describe overlap conditionally;
      // the engine's captureElementalApplication chooses the first matching status per unit.
      const branches: string[] = []
      const seenRecipients = new Set<string>()
      for (const candidate of skillEffects) {
        if (
          candidate.type !== 'apply-status' ||
          candidate.statusId !== statusId ||
          seenRecipients.has(candidate.recipient)
        )
          continue
        seenRecipients.add(candidate.recipient)
        const captured = {
          ...effect,
          durationTurns: effect.durationTurns || candidate.durationTurns,
          potencyBasisPoints: effect.potencyBasisPoints ?? candidate.potencyBasisPoints,
        }
        const interaction = skillDamageElementInteraction(
          captured,
          false,
          timingPolicy,
          undefined,
          false,
        )
        if (candidate.recipient === effect.recipient)
          return branches.join('') + (branches.length ? ' Otherwise:' : '') + interaction
        const condition =
          candidate.recipient === 'primary-unit'
            ? 'is the primary target'
            : candidate.recipient === 'actor'
              ? 'is the caster'
              : 'is among the affected units'
        branches.push(
          ` ${branches.length ? 'Otherwise, if' : 'If'} a damaged recipient ${condition}:${interaction}`,
        )
      }
      if (branches.length)
        return (
          branches.join('') +
          ' Otherwise:' +
          skillDamageElementInteraction(effect, false, timingPolicy, undefined, false)
        )
    }
    const duration = effect.durationTurns || 2
    const bonus = (effect.potencyBasisPoints ?? 2000) / 100
    const tag =
      effect.element === 'ice' ? 'frozen' : effect.element === 'water' ? 'wet' : 'conductive'
    const mode = timingPolicy?.modes[tag] ?? 'instant'
    const lifetime =
      mode === 'instant'
        ? `${duration} affected turns starting when damage settles (Instant)`
        : mode === 'next-round'
          ? `${duration} full rounds starting next round after damage settles`
          : `${duration} full rounds starting two round boundaries after damage settles (Delayed)`
    if (effect.element === 'ice')
      return ` Positive hostile HP damage applies Chilled for ${lifetime}; Chilled locks final facing to the current direction.`
    if (effect.element === 'water')
      return ` Positive hostile HP damage applies Drenched for ${lifetime}. Drenched reduces Initiative by 10% once and adds ${bonus}% Storm damage while active.`
    if (effect.element === 'storm')
      return ` Positive hostile HP damage consumes the old Conductive charge for its captured Storm bonus, then applies one fresh Conductive charge for ${lifetime} with +${bonus}% Storm damage. Drenched remains; a new charge is not consumed again in the same command.`
    if (effect.element === 'fire')
      return ' A legal Fire cast cleanses Chilled from its caster even on empty Ground or a miss. Positive Fire HP damage removes Drenched and Chilled from hostile recipients. Fire converts affected Frozen Ground to Steam mist, keeping its remaining life and blocking sight for both teams.'
  }
  if (effect.element === 'storm')
    return ' Storm gains 20% per active Wet or Conductive application once per recipient per command and consumes Conductive; Wet remains.'
  if (effect.element === 'fire')
    return ' Positive fire damage removes Wet and Frozen from units. Fire on affected Frozen tiles replaces them with Steam for two round boundaries, blocking line of sight for both teams.'
  return ''
}

function statusPreview(
  id: string,
  potencyBasisPoints?: number,
  legacyHealingDown = false,
  legacyElemental = false,
  explicitElemental = true,
  tuning: CombatStatusTuning = {},
): PreviewEffect {
  const details = {
    ...combatStatusDetails(id),
    description: statusPotencyDescription(id, potencyBasisPoints, {
      legacyHealingDown,
      legacyElemental,
      explicitElemental,
      ...tuning,
    }),
  }
  const status = PV1F_COMBAT_CONTENT.statuses.find((entry) => entry.id === id)
  const result: PreviewEffect = { label: details.name, explanation: details.description }
  // These gameplay-tag rules live in the damage/healing resolvers. Their shared
  // status descriptions are the public authority; avoid a second numeric constant.
  if (id === 'suppress') {
    result.magnitude = `${(potencyBasisPoints ?? 2500) / 100}%`
  } else if (['inspired', 'hexed', 'wet', 'conductive'].includes(id)) {
    const percent =
      !legacyElemental && (id === 'wet' || id === 'conductive')
        ? `${(potencyBasisPoints ?? 2000) / 100}%`
        : details.description.match(/\d+(?:\.\d+)?%/)?.[0]
    if (percent)
      result.magnitude =
        id === 'inspired'
          ? `+${percent} outgoing`
          : id === 'hexed'
            ? `−${percent} ${legacyHealingDown ? 'healing' : 'HP/MP recovery'}`
            : `+${percent} Storm`
  } else if (status?.markAccuracyBonusBasisPoints !== undefined) {
    result.magnitude = `+${(potencyBasisPoints ?? status.markAccuracyBonusBasisPoints) / 100} pp Accuracy`
    result.explanation = `Source gains ${result.magnitude} against this target.`
  } else if (id === 'blind' && potencyBasisPoints !== undefined) {
    result.magnitude = `−${potencyBasisPoints / 100} pp Accuracy`
  } else if (status?.movement?.additionalApPerTile !== undefined) {
    result.magnitude = `${signed(status.movement.additionalApPerTile)} AP`
    result.explanation = details.description
  } else if (status?.movement?.blocked) {
    result.explanation = 'Blocks movement; attacks, Skills and facing remain available.'
  } else if (status?.damageModifiers?.length) {
    result.magnitude = status.damageModifiers
      .map(
        (modifier) =>
          `${signed((statusDamageMultiplierBasisPoints(modifier.multiplierBasisPoints, potencyBasisPoints) - 10_000) / 100)}% ${modifier.direction}`,
      )
      .join(' / ')
    result.explanation = details.description
  } else if (status && status.damageTakenMultiplierBasisPoints !== 10_000) {
    result.magnitude = `${signed((statusDamageMultiplierBasisPoints(status.damageTakenMultiplierBasisPoints, potencyBasisPoints) - 10_000) / 100)}% incoming`
    result.explanation = details.description
  } else if (status?.endOfTurn) {
    result.magnitude = `${status.endOfTurn.amount} × ${status.durationOwnerTurnStarts} ticks`
  }
  if (potencyBasisPoints !== undefined) {
    const percent = potencyBasisPoints / 100
    if (id === 'guarded') {
      result.magnitude = `−${percent}% incoming`
    } else if (id === 'exposed') {
      result.magnitude = `+${percent}% incoming`
    }
    result.explanation = details.description
  }
  if (tuning.defenseIncreaseBasisPoints !== undefined)
    result.magnitude = `+${tuning.defenseIncreaseBasisPoints / 100}% Defense / −${tuning.defenseIncreaseBasisPoints / 100}% outgoing`
  if (tuning.movementApAdjustment !== undefined)
    result.magnitude = `${id === 'haste' ? '−' : '+'}${tuning.movementApAdjustment} AP`
  if (tuning.damageTakenMultiplierBasisPoints !== undefined)
    result.magnitude = `${tuning.damageTakenMultiplierBasisPoints / 100}% incoming`
  if (tuning.initiativeReductionBasisPoints !== undefined)
    result.magnitude = `−${tuning.initiativeReductionBasisPoints / 100}% Initiative / +${(potencyBasisPoints ?? 2000) / 100}% Storm`
  if (
    Object.keys(tuning).some((key) =>
      [
        'defenseIncreaseBasisPoints',
        'movementApAdjustment',
        'damageTakenMultiplierBasisPoints',
        'initiativeReductionBasisPoints',
      ].includes(key),
    )
  )
    result.explanation = details.description
  return result
}

export function previewEffect(
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
    timingPolicy?: CombatEffectTimingPolicy | null
    skillEffects?: readonly MatureSkillEffectDefinition[]
  } = {},
): PreviewEffect {
  const target =
    effect.recipient === 'actor'
      ? 'you'
      : effect.recipient === 'affected-units'
        ? 'each affected unit'
        : effect.recipient === 'selected-tile'
          ? 'the selected empty tile'
          : 'the target'
  if (isReversalPresentationEffect(effect))
    return {
      label: 'Reversal',
      magnitude: reversalMagnitude(effect),
      explanation: reversalDescription(effect),
    }
  switch (effect.type) {
    case 'weak-point':
      return {
        label: 'Weak Point',
        magnitude: `> ${effect.debuffThreshold} debuffs`,
        explanation: attackTagDescription(effect),
      }
    case 'spike':
      return {
        label: 'Spike',
        magnitude: '2× critical damage',
        explanation: attackTagDescription(effect),
      }
    case 'ruin':
      return {
        label: 'Ruin',
        magnitude: `+${effect.bonusPerDebuffBasisPoints / 100}% per debuff`,
        explanation: attackTagDescription(effect),
      }
    case 'endure':
      return {
        label: 'Endure',
        magnitude: `${effect.releaseBasisPoints / 100}%`,
        explanation: `${endureDescription(effect)} Lasts ${effect.durationTurns} ${effect.durationTurns === 1 ? 'turn' : 'turns'}.`,
      }
    case 'summon':
      return {
        label: 'Summon',
        explanation: 'Calls the authored allied summon onto the selected empty tile.',
      }
    case 'damage':
      return {
        label:
          effect.element === 'water'
            ? 'Water Dmg'
            : effect.element === 'storm'
              ? 'Storm Dmg'
              : effect.element === 'fire'
                ? 'Fire Dmg'
                : effect.element === 'ice'
                  ? 'Ice Dmg'
                  : 'Dmg',
        magnitude: String(effect.amount),
        explanation: `Skill power ranges from 1 to 20. Final HP damage depends on your attack stat, Level and the target’s defenses and effects.${effect.facingModifiersBasisPoints ? ` Facing: front ${effect.facingModifiersBasisPoints.front / 100}%, side ${effect.facingModifiersBasisPoints.side / 100}%, rear ${effect.facingModifiersBasisPoints.rear / 100}%.` : ''}${skillDamageElementInteraction(effect, options.legacyElemental, options.timingPolicy, options.skillEffects, options.explicitElemental)}`,
      }
    case 'percentage-recovery':
      return {
        label: effect.resource === 'hp' ? 'HP Recovery' : 'MP Recovery',
        magnitude: `${effect.percent}%`,
        explanation: `Restores ${effect.percent}% of ${target === 'you' ? 'your' : `${target}’s`} maximum ${effect.resource.toUpperCase()}${(effect.ticks ?? 1) > 1 ? ` per application, ${effect.ticks} times` : ''}. The amount is fixed when cast${effect.resource === 'hp' || !options.legacyHealingDown ? '; Healing Down reduces it' : ''}. Cannot exceed the maximum or revive.`,
      }
    case 'healing':
      return {
        label: 'Heal',
        magnitude: String(effect.amount),
        explanation: `Restores HP to ${target}${effect.ticks && effect.ticks > 1 ? ` per application, ${effect.ticks} times (first when the effect activates)` : ''}.`,
      }
    case 'barrier-change':
      return {
        label: 'Barrier',
        magnitude: `${effect.amount}${effect.basis === 'maximum-hp-percent' ? '%' : ''}`,
        explanation:
          effect.basis === 'maximum-hp-percent'
            ? `Protect ${target} with a share of maximum HP that absorbs damage before HP. Pierce breaks the Barrier.`
            : `Grants damage-absorbing Barrier to ${target}.`,
      }
    case 'resource-change':
      return {
        label: effect.delta < 0 ? 'MP Drain' : 'MP Restore',
        magnitude: `${Math.abs(effect.delta)}${effect.basis === 'maximum-mp-percent' ? '%' : ''}`,
        explanation:
          effect.delta < 0
            ? effect.basis === 'maximum-mp-percent'
              ? `Removes ${Math.abs(effect.delta)}% of ${target === 'you' ? 'your' : `${target}’s`} maximum MP, down to a minimum of zero.`
              : `Removes ${Math.abs(effect.delta)} MP from ${target}, down to a minimum of zero.`
            : `Restores MP to ${target}${effect.ticks && effect.ticks > 1 ? ` per application, ${effect.ticks} times (first when the effect activates)` : ''}.`,
      }
    case 'apply-status':
      if (effect.statusId === 'counter' && effect.counter)
        return {
          label: 'Counter',
          magnitude: `${effect.counter.kind === 'mystic' ? 'Mystical' : effect.counter.kind === 'physical' ? 'Physical' : 'Full'} ${effect.counter.basisPoints / 100}%`,
          explanation: `${counterDescription(effect.counter)} Lasts ${effect.durationTurns ?? 2} turns after activation.`,
        }
      if (effect.statusId === BLINDSIDE_DEBUFF_STATUS_ID) {
        const profile = effect.blindsideModifiersBasisPoints ?? DEFAULT_BLINDSIDE_MODIFIERS
        return {
          label: 'Blindside',
          magnitude: `${profile.side / 100}% side / ${profile.rear / 100}% rear`,
          explanation: blindsideDebuffDescription(profile),
        }
      }
      if (effect.statusId === 'blindside')
        return {
          label: 'Blindside',
          explanation: blindsideDamageDescription(
            effect.blindsideModifiersBasisPoints,
            options.legacyBlindsideActivation,
          ),
        }
      const preview =
        effect.statusId === 'airborne'
          ? {
              label: 'Airborne',
              explanation: airborneDescription(options.legacyAirborne, options.legacyAirborneJump),
            }
          : statusPreview(
              effect.statusId,
              effect.potencyBasisPoints,
              options.legacyHealingDown,
              options.legacyElemental,
              options.explicitElemental,
              effect,
            )
      if (
        !options.legacyElemental &&
        options.explicitElemental !== false &&
        ['frozen', 'wet', 'conductive'].includes(effect.statusId)
      ) {
        const overlaps = elementalStatusOverlapsDamage(effect, options.skillEffects)
        const trigger = overlaps
          ? ' For recipients also hit by this Skill’s matching elemental damage, applies only after positive hostile HP damage (actual loss after Barrier), if the recipient survives.'
          : ''
        const policy =
          options.timingPolicy === undefined
            ? defaultCombatEffectTimingPolicy()
            : options.timingPolicy
        const mode = overlaps
          ? (policy?.modes[effect.statusId] ?? 'instant')
          : combatEffectTimingMode(policy ?? undefined, effect.statusId)
        const turns = effect.durationTurns || 2
        const start = overlaps ? 'damage settles' : 'the effect activates'
        const lifetime =
          mode === 'instant'
            ? `${turns} affected ${turns === 1 ? 'turn' : 'turns'} starting when ${start} (Instant)`
            : mode === 'next-round'
              ? `${turns} full rounds starting next round after ${start}`
              : `${turns} full rounds starting two round boundaries after ${start} (Delayed)`
        return { ...preview, explanation: `${preview.explanation}${trigger} Lasts ${lifetime}.` }
      }
      return preview
    case 'displace':
      return {
        label: effect.direction === 'pull' ? 'Pull' : 'Push',
        magnitude: String(effect.distance),
        explanation: `Moves ${target} ${effect.direction === 'pull' ? 'toward you' : 'away'}; stops at blocked tiles or Rooted.`,
      }
    case 'burn': {
      if (isPercentageDotEffect(effect))
        return {
          label: 'Burn',
          magnitude: percentageDotMagnitude(effect),
          explanation: percentageDotDescription('burn', effect.backlashBasisPoints, options),
        }
      const turns = effect.durationTurns ?? CURRENT_BURN_DAMAGE_BY_STAGE.length
      const values =
        effect.power === undefined
          ? CURRENT_BURN_DAMAGE_BY_STAGE.slice(0, turns)
          : Array.from({ length: turns }, (_, index) => Math.max(1, effect.power! - index))
      return {
        label: 'Burn',
        magnitude: values.join('/'),
        explanation: `Fixed damage at the next ${turns} turn ${turns === 1 ? 'end' : 'ends'} for each active application.`,
      }
    }
    case 'bleed':
      if (isPercentageDotEffect(effect))
        return {
          label: 'Bleed',
          magnitude: percentageDotMagnitude(effect),
          explanation: percentageDotDescription('bleed'),
        }
      return {
        label: 'Bleed',
        magnitude: `${effect.damagePerTick} × ${effect.ticks} ticks`,
        explanation: 'Fixed damage at turn end for each active application.',
      }
    case 'poison': {
      if (isPercentageDotEffect(effect))
        return {
          label: 'Poison',
          magnitude: percentageDotMagnitude(effect),
          explanation: percentageDotDescription('poison', undefined, options),
        }
      const turns = effect.durationTurns
      return {
        label: 'Poison',
        magnitude: String(effect.power ?? CURRENT_POISON_DAMAGE),
        explanation:
          turns === undefined
            ? 'Fixed damage at turn end and every five voluntarily entered tiles, until removed.'
            : `Fixed damage at turn end and every five voluntarily entered tiles for ${turns} ${turns === 1 ? 'turn' : 'turns'}.`,
      }
    }
    case 'remove-status': {
      if (effect.removalMode === 'all-debuffs')
        return { label: 'Cleanse', explanation: 'Removes All Debuffs.' }
      if (effect.removalMode === 'specified') {
        const label = combatEffectPresentationTags(effect)[0]!
        return {
          label,
          magnitude: combatStatusSelectionSummary(
            effect.statusIds,
            label === 'Dispel' ? 'buffs' : 'debuffs',
          ).replaceAll(', ', ' / '),
          explanation: `Removes ${combatStatusSelectionSummary(effect.statusIds, effect.statusIds.every((id) => combatStatusDetails(id).kind === 'Buff') ? 'buffs' : 'debuffs')}.`,
        }
      }
      if (
        isCleanseChilledEffect(effect) &&
        !options.legacyElemental &&
        options.explicitElemental !== false
      )
        return {
          label: 'Cleanse Chilled',
          explanation: `Removes Chilled from ${effect.recipient === 'actor' ? 'the caster' : effect.recipient === 'affected-units' ? 'each affected unit' : 'the selected unit'} only; other statuses remain.`,
        }
      const ids = effect.statusIds.every((id) => combatStatusDetails(id).kind === 'Buff')
        ? effect.statusIds
        : [...effect.statusIds, 'suppress']
      const statusNames = [...new Set(ids.map((id) => combatStatusDetails(id).name))]
      return {
        label: effect.statusIds.every((id) => combatStatusDetails(id).kind === 'Buff')
          ? 'Dispel'
          : 'Cleanse',
        explanation: `Removes ${statusNames.join(', ')}.`,
      }
    }
    case 'create-terrain':
      if (effect.skillApSurcharge !== undefined)
        return {
          label: 'Frozen Ground',
          magnitude: `+${effect.skillApSurcharge} Skill AP`,
          explanation:
            'Raises the AP cost of Skills used by grounded enemies on the affected tiles. Airborne ignores it. Fire turns it into sight-blocking Steam.',
        }
      return {
        label: 'Frozen Ground',
        magnitude: `+${COMBAT_TERRAIN_OVERLAY_DETAILS.frozen.additionalApPerTile} AP/tile`,
        explanation: `${options.legacyFrozenGround ? 'Both teams' : 'Only the caster’s enemies'} pay extra movement AP; fire turns it into sight-blocking Steam.`,
      }
    case 'return-to-turn-start':
      return {
        label: 'Rewind',
        explanation:
          effect.target !== undefined && effect.target !== 'self'
            ? 'Returns each recipient to its own tile captured at the initial legal cast if still legal; restores position only and refunds no resources.'
            : effect.anchorMode === 'cast-position'
              ? 'Returns you to the tile captured when cast if legal; refunds no resources.'
              : 'Returns you to your turn-start tile if legal; refunds no resources.',
      }
    case 'copy-statuses': {
      const kind = effect.mode === 'amplify' ? 'copy-buffs' : 'copy-debuffs'
      const selected = combatStatusSelectionSummary(
        effect.statusIds ?? selectableCombatStatusIds(kind),
        kind,
      )
      return {
        label: effect.mode === 'amplify' ? 'Copy Buffs' : 'Copy Debuffs',
        ...(effect.statusIds !== undefined ? { magnitude: selected } : {}),
        explanation:
          effect.mode === 'amplify'
            ? `Copies ${selected} from the target to you. Originals remain; remaining durations are preserved.`
            : `Copies ${selected} from you to the target. Originals remain; remaining durations are preserved.`,
      }
    }
    case 'sensory':
      return {
        label: 'Reveal',
        explanation:
          effect.increasedDamageTakenBasisPoints === undefined
            ? 'On a hit against Covert, strips eligible buffs and applies Revealed.'
            : `A successful hit against Invisible or Covert removes both concealments and applies Revealed for ${effect.revealedDurationOwnerTurnStarts} turns: take ${effect.increasedDamageTakenBasisPoints / 100}% more damage; incoming attacks have 100% Accuracy.`,
      }
  }
}

/** Shared current/captured wording for native Skills, Essence packets and Resonance results. */
export function previewEffectWithTag(
  effect: MatureSkillEffectDefinition,
  presentations?: readonly CombatTagPresentationSnapshot[],
  options: NonNullable<Parameters<typeof previewEffect>[1]> = {},
): PreviewEffect {
  const generated = previewEffect(effect, options)
  const tagPresentation = resolvedCombatEffectTagPresentation(
    presentations,
    effect,
    generated.explanation,
  )
  return tagPresentation
    ? {
        ...generated,
        label: tagPresentation.name,
        explanation: tagPresentation.full,
        tagPresentation,
      }
    : generated
}

export function skillPreviewEffects(
  skill: Pick<MatureSkillDefinition, 'effects' | 'effectDescriptions' | 'tagPresentation'>,
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
    timingPolicy?: CombatEffectTimingPolicy | null
  } = {},
): readonly PreviewEffect[] {
  const seen = new Set<string>()
  return groupSkillEffects(skill.effects, skill.effectDescriptions)
    .map(({ effect, firstIndex: index }) => {
      const entry = previewEffectWithTag(effect, skill.tagPresentation, {
        ...options,
        skillEffects: skill.effects,
      })
      if (entry.tagPresentation) return entry
      const override = skill.effectDescriptions?.[index]?.trim()
      if (
        override &&
        effect.type === 'apply-status' &&
        !options.legacyElemental &&
        options.explicitElemental !== false &&
        ['frozen', 'wet', 'conductive'].includes(effect.statusId)
      )
        return { ...entry, explanation: `${override} ${entry.explanation}` }
      return override
        ? {
            ...entry,
            explanation:
              override +
              (!options.legacyElemental
                ? skillDamageElementInteraction(
                    effect,
                    false,
                    options.timingPolicy,
                    skill.effects,
                    options.explicitElemental,
                  )
                : ''),
          }
        : entry
    })
    .filter((entry) => {
      const key = JSON.stringify([entry.label, entry.explanation])
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function effectSummary(effect: PreviewEffect): string {
  return effect.magnitude === undefined ? effect.label : `${effect.label} [${effect.magnitude}]`
}
