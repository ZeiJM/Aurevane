import type { BattlePresentedStatus } from './battle-elevation-effects'

type CapturedPolicy = Pick<BattlePresentedStatus, 'statusId'> &
  Partial<
    Pick<
      BattlePresentedStatus,
      'applicationModifiers' | 'effectStackingPolicyVersion' | 'elementalDamagePolicyVersion'
    >
  >

/** Missing encounter policy retains native historical whole-row stacking. */
export function hasCapturedApplicationStacking(effect: CapturedPolicy): boolean {
  return (
    effect.effectStackingPolicyVersion === 1 ||
    (['wet', 'conductive'].includes(effect.statusId) &&
      effect.elementalDamagePolicyVersion !== undefined)
  )
}

export function capturedBattleEffectStatus<T extends CapturedPolicy>(effect: T): T {
  return hasCapturedApplicationStacking(effect)
    ? effect
    : { ...effect, applicationModifiers: undefined }
}
