import {
  CURRENT_EFFECT_PERCENT_MAXIMUM,
  CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS,
  CURRENT_EFFECT_BONUS_MULTIPLIER_MAXIMUM_BASIS_POINTS,
} from '@aurevane/game-core/combat/combat-effect-percentages'

interface PercentageEntry {
  readonly owner: Record<string, unknown>
  readonly key: string
  readonly path: string
  readonly maximum: number
  readonly divisor: number
}
const percentageFields = new Set([
  'potencyBasisPoints',
  'initiativeReductionBasisPoints',
  'defenseIncreaseBasisPoints',
  'damageTakenMultiplierBasisPoints',
  'increasedDamageTakenBasisPoints',
  'bonusPerDebuffBasisPoints',
  'releaseBasisPoints',
  'reflectionBasisPoints',
  'attackerMaxHpCapBasisPoints',
  'defenderMaxHpCapBasisPoints',
  'armorIgnoredBasisPoints',
  'percentageBasisPoints',
  'backlashBasisPoints',
  'decayBasisPointsPerTick',
  'conversionBasisPoints',
])

/** New edits only. Never use this ceiling when reading saved combat captures. */
export function currentCombatPercentageEntries(value: unknown): readonly PercentageEntry[] {
  const entries: PercentageEntry[] = []
  const seen = new WeakSet<object>()
  function visit(input: unknown, path: string, parentKey = '') {
    if (!input || typeof input !== 'object' || seen.has(input)) return
    seen.add(input)
    if (Array.isArray(input)) {
      input.forEach((child, index) => visit(child, `${path}[${index}]`, parentKey))
      return
    }
    const row = input as Record<string, unknown>
    for (const [key, child] of Object.entries(row)) {
      const childPath = path ? `${path}.${key}` : key
      let maximum: number | undefined
      let divisor = 100
      if (percentageFields.has(key)) maximum = CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS
      if (
        (key === 'basisPoints' && ['counter', 'damageProfile'].includes(parentKey)) ||
        (['front', 'side', 'rear'].includes(key) &&
          ['facingModifiersBasisPoints', 'blindsideModifiersBasisPoints'].includes(parentKey))
      )
        maximum = CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS
      if (key === 'multiplierBasisPoints' && row.type === 'damage-bonus')
        maximum = CURRENT_EFFECT_BONUS_MULTIPLIER_MAXIMUM_BASIS_POINTS
      if (
        (key === 'percent' && row.type === 'percentage-recovery') ||
        (key === 'delta' && row.type === 'resource-change' && row.basis === 'maximum-mp-percent') ||
        (key === 'amount' && row.type === 'barrier-change' && row.basis === 'maximum-hp-percent')
      ) {
        maximum = CURRENT_EFFECT_PERCENT_MAXIMUM
        divisor = 1
      }
      if (maximum !== undefined && typeof child === 'number')
        entries.push({ owner: row, key, path: childPath, maximum, divisor })
      visit(child, childPath, key)
    }
  }
  visit(value, '')
  return entries
}

export function currentCombatPercentageIssues(value: unknown) {
  return currentCombatPercentageEntries(value)
    .filter(({ owner, key, maximum }) => Math.abs(owner[key] as number) > maximum)
    .map(({ path }) => ({
      path,
      code: 'INVALID_EFFECT_PERCENTAGE',
      message: `Effect percentages must not exceed ${CURRENT_EFFECT_PERCENT_MAXIMUM}%.`,
    }))
}

/** Existing oversized captures remain editable one field at a time. */
export function combatPercentageEditIsWithinBounds(previous: unknown, next: unknown): boolean {
  const before = new Map(
    currentCombatPercentageEntries(previous).map((entry) => [entry.path, entry.owner[entry.key]]),
  )
  return currentCombatPercentageEntries(next).every(
    ({ owner, key, path, maximum }) =>
      Math.abs(owner[key] as number) <= maximum ||
      owner[key] === before.get(path) ||
      Number.isNaN(owner[key]),
  )
}
