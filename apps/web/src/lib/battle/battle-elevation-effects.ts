import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'

/** Viewer-only rows. This metadata is never part of the persisted combat status lifetime. */
export type BattlePresentedStatus = CombatStatusInstance & {
  presentationDuration?: 'while-elevated'
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
