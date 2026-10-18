import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import type { BattlePresentedStatus } from '@/lib/battle/battle-elevation-effects'
import { formatBattleEffectPercent, multiplyBattleEffectRatio } from './battle-effect-ratio'

/** Nominal captured multiplier only: native recovery also floors after every modifier. */
export function battleEffectRecoveryStrengthInformation(effect: BattlePresentedStatus) {
  const rows: { label: string; magnitude: string }[] = []
  const notes: string[] = []
  if (
    effect.statusId !== 'hexed' ||
    !PV1F_COMBAT_CONTENT.statuses.some(
      (row) => row.id === effect.statusId && row.version === effect.statusVersion,
    )
  )
    return { rows, notes }
  const scope = effect.timingState === 'pending' ? 'on activation' : 'from this effect'
  const appliesToMp = effect.healingDownPolicyVersion === 1
  const applications =
    effect.effectStackingPolicyVersion === 1
      ? (effect.applicationModifiers ?? [
          { stacks: effect.stacks, potencyBasisPoints: effect.potencyBasisPoints },
        ])
      : [{ stacks: 1, potencyBasisPoints: effect.potencyBasisPoints }]
  let magnitude: string
  try {
    let numerator = 10_000n
    let denominator = 1n
    for (const application of applications)
      [numerator, denominator] = multiplyBattleEffectRatio(
        numerator,
        denominator,
        Math.max(0, 10_000 - (application.potencyBasisPoints ?? 2500)),
        application.stacks,
      )
    const rounded = (numerator + denominator / 2n) / denominator
    magnitude =
      numerator > 0n && rounded === 0n
        ? '<0.01% before rounding'
        : `${numerator % denominator === 0n ? '' : '≈'}${formatBattleEffectPercent(rounded)} before rounding`
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    magnitude = 'Unavailable'
    notes.push('Combined recovery multiplier unavailable.')
  }
  rows.push({ label: `HP recovery ${scope}`, magnitude })
  rows.push({
    label: `MP recovery ${scope}`,
    magnitude: appliesToMp ? magnitude : '100% before rounding',
  })
  notes.push(
    'The affected recovery is rounded down after each applied modifier. Actual recovery is capped by missing HP or MP.',
  )
  notes.push('Previously captured percentage recovery keeps its recorded amount.')
  if (!appliesToMp) notes.push('Historical rules do not reduce MP recovery or Absorb.')
  return { rows, notes }
}
