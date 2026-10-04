import {
  createPv1fBasicAttackDefinition,
  createPv1fMpRecoveryAction,
  createPv1fRecoverAction,
  PV1F_BASIC_ATTACK_BASE_DAMAGE,
  PV1F_BASIC_ATTACK_POWER_SCALING_BASIS_POINTS,
  PV1F_GUARD_ACTION,
  PV1F_GUARDED_STATUS,
  PV1F_MP_RECOVER_PERCENT,
  PV1F_RECOVER_PERCENT,
  pv1fCooldownForAction,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
  PV1F_SKILLS,
} from '@aurevane/game-core/combat/pv1f-skills'
import {
  skillParameterRows,
  skillEffectInstantTiming,
  type CompactSkillEffectSummaryParts,
} from './skill-detail-presentation'

import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import type { SkillEffectTimingPolicy } from './skill-effect-timing-context'
import { skillInformationRows, type SkillCharacteristic } from './skill-information-contract'
export type { SkillCharacteristic } from './skill-information-contract'
export type BasicActionPresentationId = (typeof PV1F_SKILLS)[number]['id']

/** Inherent effects retain their authoritative formulas in the same visual grammar as Skills. */
export function basicActionEffectSummaryParts(
  id: BasicActionPresentationId,
  timingPolicy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
): CompactSkillEffectSummaryParts {
  if (id === PV1F_GUARD_ACTION_ID) {
    return {
      label: 'Guarded',
      magnitude: `${(10_000 - PV1F_GUARDED_STATUS.damageTakenMultiplierBasisPoints!) / 100}%`,
      duration: `${PV1F_GUARDED_STATUS.durationOwnerTurnStarts} Turns`,
      ...(skillEffectInstantTiming(PV1F_GUARD_ACTION.effects[0]!, timingPolicy)
        ? { timing: 'Instant' as const }
        : {}),
    }
  }
  if (id === PV1F_BASIC_ATTACK_ID) {
    return {
      label: 'Dmg',
      magnitude: `${PV1F_BASIC_ATTACK_BASE_DAMAGE} + floor(${PV1F_BASIC_ATTACK_POWER_SCALING_BASIS_POINTS / 100}% Physical Power)`,
      duration: null,
    }
  }
  if (id === 'basic.move') {
    return {
      label: 'Move',
      magnitude: '1 Movement per entered tile',
      duration: null,
      timing: 'Instant',
    }
  }
  return {
    label: id === PV1F_RECOVER_ACTION_ID ? 'HP Recovery' : 'MP Recovery',
    magnitude: `${id === PV1F_RECOVER_ACTION_ID ? PV1F_RECOVER_PERCENT : PV1F_MP_RECOVER_PERCENT}% max ${id === PV1F_RECOVER_ACTION_ID ? 'HP' : 'MP'}`,
    duration: null,
    ...(skillEffectInstantTiming(
      id === PV1F_RECOVER_ACTION_ID
        ? createPv1fRecoverAction(100).effects[0]!
        : createPv1fMpRecoveryAction(100).effects[0]!,
      timingPolicy,
    )
      ? { timing: 'Instant' as const }
      : {}),
  }
}

function basicActionEffectsSummary(
  id: BasicActionPresentationId,
  timingPolicy: SkillEffectTimingPolicy,
): string {
  const { label, magnitude, duration, timing } = basicActionEffectSummaryParts(id, timingPolicy)
  return `${label}${magnitude ? ` [${magnitude}]` : ''}${duration ? ` [${duration}]` : ''}${timing ? ` [${timing}]` : ''}`
}

/** Inherent commands reuse Skill parameter grammar without fabricating authored Skill identities. */
export function basicActionCharacteristicRows(
  id: BasicActionPresentationId,
  timingPolicy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
): readonly SkillCharacteristic[] {
  const skill = PV1F_SKILLS.find((entry) => entry.id === id)!
  if (id === 'basic.move') {
    return skillInformationRows({
      'Skill Type': 'Utility',
      Cost: `${skill.cost.amount} AP per terrain-cost point; terrain and active movement modifiers apply`,
      Cooldown: 'None',
      Requirements:
        'AP and Movement remaining; a legal, unoccupied path; no movement-blocking status',
      Effects: basicActionEffectsSummary(id, timingPolicy),
      Range: 'Remaining Movement allowance',
      Target: 'Empty Ground',
      'Target Method': 'Path',
      'Target Elevation': 'Each step must fit the committed Jump / movement profile',
      'Line of Sight': 'Not required',
    })
  }

  // Reference magnitudes materialize only target/requirement metadata; the Effects row displays
  // the authoritative percentage/formula rather than pretending to know character resources.
  const action =
    id === PV1F_BASIC_ATTACK_ID
      ? createPv1fBasicAttackDefinition(PV1F_BASIC_ATTACK_BASE_DAMAGE)
      : id === PV1F_GUARD_ACTION_ID
        ? PV1F_GUARD_ACTION
        : id === PV1F_RECOVER_ACTION_ID
          ? createPv1fRecoverAction(100)
          : createPv1fMpRecoveryAction(100)
  const cooldown = pv1fCooldownForAction(id)
  const rows = skillParameterRows({
    ...action,
    apCost: skill.cost.amount,
    mpCost: action.cost.mp,
    cooldown,
  })
  return rows.map(([label, value]): SkillCharacteristic => {
    if (label === 'Effects') return [label, basicActionEffectsSummary(id, timingPolicy)]
    // Server battle-action-resource-availability rejects MP Recovery when MP is full.
    if (label === 'Requirements' && id === PV1F_MP_RECOVER_ACTION_ID) {
      return [label, 'Missing MP']
    }
    return [label, value]
  })
}

/** Match registered inherent names, never infer mechanics from an authored Technique's label. */
export function basicActionIdForCommand(
  slot: string,
  label: string,
): BasicActionPresentationId | null {
  if (!['move', 'attack', 'guard', 'recover'].includes(slot)) return null
  return PV1F_SKILLS.find((skill) => skill.name === label)?.id ?? null
}

/** Explain the single inherent effect separately from its numeric parameter fields. */
export function basicActionEffectExplanation(id: BasicActionPresentationId): string {
  if (id === PV1F_GUARD_ACTION_ID) {
    return `Reduces incoming damage by ${(10_000 - PV1F_GUARDED_STATUS.damageTakenMultiplierBasisPoints!) / 100}% per application. Each use refreshes the duration.`
  }
  if (id === PV1F_RECOVER_ACTION_ID || id === PV1F_MP_RECOVER_ACTION_ID) {
    return 'Restores the resource up to its maximum when the effect activates. HP and MP Recovery share a cooldown.'
  }
  if (id === PV1F_BASIC_ATTACK_ID) {
    return 'Deals physical damage to the selected enemy using the shown formula.'
  }
  return 'Move along orthogonally adjacent tiles, spending AP and 1 Movement per entered tile. Terrain changes AP cost rather than your Movement allowance.'
}

/** Read-only Inspect and Final Facing use the same report, without inventing Skill content. */
export function commandCharacteristicRows(
  slot: string,
  label: string,
  cost: string,
  timingPolicy: SkillEffectTimingPolicy = defaultCombatEffectTimingPolicy(),
): readonly SkillCharacteristic[] {
  const id = basicActionIdForCommand(slot, label)
  if (id) return basicActionCharacteristicRows(id, timingPolicy)
  if (slot === 'inspect' || slot === 'finish') {
    const inspect = slot === 'inspect'
    return skillInformationRows({
      'Skill Type': 'Utility',
      Cost: cost,
      Cooldown: inspect ? 'N/A' : 'None',
      Requirements: inspect ? 'None' : 'Your active turn',
      Effects: inspect
        ? 'Inspect visible character or tile information'
        : 'Choose final facing and end your turn',
      Range: 'N/A',
      Target: inspect ? 'Character or Ground' : 'Self',
      'Target Method': inspect ? 'Single' : 'Facing',
      'Target Elevation': 'N/A',
      'Line of Sight': 'N/A',
    })
  }
  return skillInformationRows({
    'Skill Type': 'Unavailable',
    Cost: cost,
    Cooldown: 'Unavailable',
    Requirements: 'Unavailable',
    Effects: 'Unavailable',
    Range: 'Unavailable',
    Target: 'Unavailable',
    'Target Method': 'Unavailable',
    'Target Elevation': 'Unavailable',
    'Line of Sight': 'Unavailable',
  })
}
