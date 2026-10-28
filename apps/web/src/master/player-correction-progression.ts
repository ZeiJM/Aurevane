import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import {
  personalAttributePointPoolForLevel,
  validateAttributeAllocation,
  type DisciplineAttributePolicy,
} from '@aurevane/game-core/character/attribute-allocation'
import {
  resolveLevelProgress,
  validateLevelProgressionCurve,
  type LevelProgressionCurve,
} from '@aurevane/game-core/character/progression'

export function xpForPlayerLevel(level: number, curve: LevelProgressionCurve): number {
  if (
    validateLevelProgressionCurve(curve).length ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > curve.maxLevel
  )
    throw new Error('Choose a whole Level within this character’s progression limit.')
  return curve.cumulativeXpByLevel[level - 1]!
}

/** Preview only; the existing correction transaction validates the same pinned rules. */
export function playerProgressionProposal(
  attributes: CharacterAttributes,
  xp: number,
  curve: LevelProgressionCurve,
  policy: DisciplineAttributePolicy,
) {
  const { level } = resolveLevelProgress(xp, curve)
  if (xp > curve.cumulativeXpByLevel[curve.maxLevel - 1]!)
    throw new Error('XP exceeds this character’s progression limit.')
  const issues = validateAttributeAllocation({ attributes, level, policy })
  const personal = CHARACTER_ATTRIBUTE_IDS.map((id) => attributes[id] - policy.baseAttributes[id])
  const personalSpent = personal.reduce((sum, value) => sum + value, 0)
  const personalPool = personalAttributePointPoolForLevel(level)
  const excess = Math.max(0, personalSpent - personalPool)
  let fitLevel: number | null = null
  let redistribution: CharacterAttributes | null = null
  if (issues.every((issue) => issue.code === 'point-pool-exceeded')) {
    for (let candidate = level; candidate <= curve.maxLevel; candidate++) {
      if (!validateAttributeAllocation({ attributes, level: candidate, policy }).length) {
        fitLevel = candidate
        break
      }
    }
    if (excess > 0) {
      // Keep proportions of personal points, never of the Discipline-owned bases.
      // Original values already fit the caps; reduction cannot exceed those caps.
      const numerators = personal.map((value) => value * personalPool)
      const assigned = numerators.map((value) => Math.floor(value / personalSpent))
      let remaining = personalPool - assigned.reduce((sum, value) => sum + value, 0)
      const order = numerators
        .map((value, index) => ({ index, remainder: value % personalSpent }))
        .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
      for (const row of order) {
        if (!remaining) break
        assigned[row.index] = assigned[row.index]! + 1
        remaining--
      }
      redistribution = Object.fromEntries(
        CHARACTER_ATTRIBUTE_IDS.map((id, index) => [
          id,
          policy.baseAttributes[id] + assigned[index]!,
        ]),
      ) as CharacterAttributes
    }
  }
  return {
    level,
    personalSpent,
    personalPool,
    excess,
    unspent: Math.max(0, personalPool - personalSpent),
    issues,
    fitLevel,
    fitXp: fitLevel === null ? null : xpForPlayerLevel(fitLevel, curve),
    redistribution,
  }
}
