import {
  reversalDescription,
  REVERSAL_STRAIN_DESCRIPTION,
  type ReversalPresentationValues,
} from '../reversal-presentation'
import type { BattleTagWording } from './battle-tag-wording'
import type { CombatEffectPresentationStatus } from '@aurevane/game-core/combat/combat-effect-timing'

/** Viewer-only rows. This metadata is never part of the persisted combat status lifetime. */
export type BattlePresentedStatus = CombatEffectPresentationStatus & {
  battleTag?: BattleTagWording
  effectStackingPolicyVersion?: 1
  elementalDamagePolicyVersion?: 1 | 2
  airbornePolicyVersion?: 1
  airborneJumpPolicyVersion?: 1
  healingDownPolicyVersion?: 1
  blindsideActivationPolicyVersion?: 1
  presentationDuration?:
    'while-elevated' | 'while-primed' | 'until-reversal-ends' | 'next-complete-owner-turn'
  reversal?: ReversalPresentationValues
}

export const TERRAIN_EVASION_STATUS_ID = 'terrain-evasion'
export const TERRAIN_DEFENSE_STATUS_ID = 'terrain-defense'

export function terrainBattleEffectPresentation(
  effect: Pick<
    BattlePresentedStatus,
    'statusId' | 'statusVersion' | 'presentationDuration' | 'potencyBasisPoints'
  >,
) {
  if (
    effect.presentationDuration !== 'while-elevated' ||
    effect.statusVersion !== 1 ||
    effect.potencyBasisPoints === undefined
  )
    return null
  const percent = effect.potencyBasisPoints / 100
  const duration = 'While on elevated terrain'
  if (effect.statusId === TERRAIN_EVASION_STATUS_ID)
    return {
      label: 'Elevation Evasion',
      kind: 'Buff',
      identifier: 'EVA',
      duration,
      description: `Evasion +${percent}%. Skills with sufficient Target Elevation bypass this terrain bonus; Basic Attack retains it. This position-derived effect cannot be copied or cleansed.`,
    }
  if (effect.statusId === TERRAIN_DEFENSE_STATUS_ID)
    return {
      label: 'Elevated Defenses',
      kind: 'Debuff',
      identifier: 'DEF',
      duration,
      description: `Physical Defense −${percent}%; Mystic Defense −${percent}%. Applied before damage mitigation. This position-derived effect cannot be copied or cleansed.`,
    }
  return null
}

/** Derived from genuine Controlled memory; never grants an independently mutable status. */
export function primedBattleEffectPresentation(
  effect: Pick<BattlePresentedStatus, 'statusId' | 'statusVersion' | 'presentationDuration'>,
) {
  if (
    effect.statusId !== 'primed' ||
    effect.statusVersion !== 1 ||
    effect.presentationDuration !== 'while-primed'
  )
    return null
  return {
    label: 'Primed',
    kind: 'Effect',
    identifier: 'PRI',
    count: null,
    counterLabel: 'Ready',
    timing: 'Primed',
    timingState: 'primed',
    duration: 'While a Controlled skill remains primed',
    description:
      'A Controlled skill is prepared for release. Primed ends when it is released, cancelled, its source is removed, the character is defeated, or battle ends. This derived tag cannot be applied, copied or cleansed.',
  }
}

/** Read-only system consequence and armed state; neither is an ordinary mutable status. */
export function reversalBattleEffectPresentation(
  effect: Pick<
    BattlePresentedStatus,
    'statusId' | 'statusVersion' | 'presentationDuration' | 'reversal'
  >,
) {
  if (effect.statusVersion !== 1) return null
  if (
    effect.statusId === 'reversal-strain' &&
    effect.presentationDuration === 'next-complete-owner-turn'
  )
    return {
      label: 'Reversal Strain',
      kind: 'Debuff',
      identifier: 'RST',
      count: null,
      counterLabel: 'Restricted',
      timing: 'Active',
      timingState: 'active',
      duration: 'Through the end of the next complete owner turn',
      description: REVERSAL_STRAIN_DESCRIPTION,
    }
  if (
    effect.statusId !== 'reversal' ||
    effect.presentationDuration !== 'until-reversal-ends' ||
    !effect.reversal
  )
    return null
  return {
    label: 'Reversal',
    kind: 'Buff',
    identifier: 'RVS',
    count: null,
    counterLabel: 'Armed',
    timing: 'Armed',
    timingState: 'primed',
    duration: 'Until triggered or the start of the next actual owner turn',
    description: `${reversalDescription(effect.reversal)} This armed state cannot be copied or removed by generic Cleanse or Dispel.`,
  }
}
