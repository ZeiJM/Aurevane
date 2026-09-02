import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'

const BASIS_POINTS = 10_000

export type BattleEffectSummaryTone = 'buff' | 'debuff' | 'neutral'
export type BattleEffectSummaryItem = {
  label: string
  value: string
  tone: BattleEffectSummaryTone
}

type BattleStatusSummaryInput = {
  statusId: string
  statusVersion: number
  stacks: number
}

function compactPercent(value: number): string {
  const percent = Math.abs(value) / 100
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}

/**
 * Vulnerabilities are shown as the total incoming-damage rate so a 2.5x
 * multiplier reads as 250%. Reductions remain a signed delta from normal so
 * Guard's 0.85x multiplier keeps its familiar -15% presentation.
 */
export function formatIncomingDamageEffect(multiplierBasisPoints: number): string {
  if (multiplierBasisPoints > BASIS_POINTS) {
    return `${compactPercent(multiplierBasisPoints)}%`
  }

  const delta = multiplierBasisPoints - BASIS_POINTS
  if (delta === 0) return '±0%'
  return `${delta > 0 ? '+' : '−'}${compactPercent(delta)}%`
}

export function statusIsBeneficial(statusId: string): boolean {
  return statusId === 'guarded' || statusId.startsWith('buff.')
}

export function summarizeBattleEffects(
  statuses: readonly BattleStatusSummaryInput[],
): BattleEffectSummaryItem[] {
  let buffStacks = 0
  let debuffStacks = 0
  let damageTakenMultiplier = BASIS_POINTS
  let measuredDamageTaken = false

  for (const status of statuses) {
    const stacks = Math.max(1, status.stacks)
    if (statusIsBeneficial(status.statusId)) buffStacks += stacks
    else debuffStacks += stacks

    const definition = PV1F_COMBAT_CONTENT.statuses.find(
      (candidate) => candidate.id === status.statusId && candidate.version === status.statusVersion,
    )
    if (!definition || definition.damageTakenMultiplierBasisPoints === BASIS_POINTS) continue

    measuredDamageTaken = true
    for (let stack = 0; stack < stacks; stack += 1) {
      damageTakenMultiplier = Math.round(
        (damageTakenMultiplier * definition.damageTakenMultiplierBasisPoints) / BASIS_POINTS,
      )
    }
  }

  const summary: BattleEffectSummaryItem[] = []
  if (measuredDamageTaken) {
    const delta = damageTakenMultiplier - BASIS_POINTS
    summary.push({
      label: 'DMG IN',
      value: formatIncomingDamageEffect(damageTakenMultiplier),
      tone: delta < 0 ? 'buff' : delta > 0 ? 'debuff' : 'neutral',
    })
  }
  if (buffStacks > 0) summary.push({ label: 'BUFF', value: `+${buffStacks}`, tone: 'buff' })
  if (debuffStacks > 0) {
    summary.push({ label: 'DEBUFF', value: `−${debuffStacks}`, tone: 'debuff' })
  }
  return summary
}
