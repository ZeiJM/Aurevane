import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'

const BASIS_POINTS = 10_000

export type BattleEffectSummaryTone = 'buff' | 'debuff' | 'neutral'
export type BattleEffectSummaryItem = {
  label: string
  value: string
  tone: BattleEffectSummaryTone
}

export type BattleStatusSummaryInput = {
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

export function statusLabel(statusId: string): string {
  if (statusId === 'guarded') return 'Guarded'
  if (statusId === 'lowered-guard' || statusId === 'lowered.guard') return 'Lowered Guard'

  const readableId = statusId
    .replace(/^(?:buff|debuff)[._:-]/u, '')
    .replace(/[._-]+/gu, ' ')
    .trim()
  if (!readableId) return statusId

  return readableId
    .split(/\s+/u)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatStatusStackCount(statusId: string, stacks: number): string {
  const count = Math.max(1, stacks)
  return `${statusIsBeneficial(statusId) ? '+' : '−'}${count}`
}

export function aggregateBattleStatusStacks<T extends BattleStatusSummaryInput>(
  statuses: readonly T[],
): T[] {
  const grouped = new Map<string, T>()

  for (const status of statuses) {
    const stacks = Math.max(1, status.stacks)
    const key = `${status.statusId}:${status.statusVersion}`
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...status, stacks })
      continue
    }

    grouped.set(key, {
      ...existing,
      stacks: Math.max(1, existing.stacks) + stacks,
    })
  }

  return [...grouped.values()]
}

export function summarizeBattleEffects(
  statuses: readonly BattleStatusSummaryInput[],
): BattleEffectSummaryItem[] {
  let damageTakenMultiplier = BASIS_POINTS
  let measuredDamageTaken = false
  const groupedStatuses = aggregateBattleStatusStacks(statuses)

  for (const status of groupedStatuses) {
    const stacks = Math.max(1, status.stacks)

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

  for (const status of groupedStatuses) {
    summary.push({
      label: statusLabel(status.statusId),
      value: formatStatusStackCount(status.statusId, status.stacks),
      tone: statusIsBeneficial(status.statusId) ? 'buff' : 'debuff',
    })
  }

  return summary
}
