export const CURRENT_LEVEL_CAP = 100 as const
export const XP_PROGRESS_BASIS_POINTS = 10_000 as const

export interface LevelProgressionCurve {
  version: number
  maxLevel: number
  cumulativeXpByLevel: readonly number[]
}

export interface LevelProgressionCurveIssue {
  field: string
  message: string
}

export interface LevelProgress {
  curveVersion: number
  level: number
  maxLevel: number
  totalXp: number
  currentLevelThreshold: number
  nextLevelThreshold: number | null
  xpIntoLevel: number
  xpRequiredForNextLevel: number | null
  progressBasisPoints: number
  isMaxLevel: boolean
}

export interface XpGrantResolution {
  requestedAmount: number
  appliedAmount: number
  xpBefore: number
  xpAfter: number
  levelBefore: number
  levelAfter: number
  reachedLevel: number | null
  isMaxLevel: boolean
}

export type CharacterXpGrantSourceKind = 'system' | 'gameplay' | 'support' | 'owner'

export interface CharacterLevelUpEvent {
  event: 'character_level_up'
  characterId: string
  progressionCycle: number
  curveVersion: number
  levelBefore: number
  levelAfter: number
}

export function validateLevelProgressionCurve(
  curve: LevelProgressionCurve,
): readonly LevelProgressionCurveIssue[] {
  const issues: LevelProgressionCurveIssue[] = []

  if (!Number.isInteger(curve.version) || curve.version <= 0) {
    issues.push({ field: 'version', message: 'Curve version must be a positive integer.' })
  }

  if (
    !Number.isInteger(curve.maxLevel) ||
    curve.maxLevel < 1 ||
    curve.maxLevel > CURRENT_LEVEL_CAP
  ) {
    issues.push({
      field: 'maxLevel',
      message: `Maximum Level must be a whole number from 1 to ${CURRENT_LEVEL_CAP}.`,
    })
  }

  if (curve.cumulativeXpByLevel.length !== curve.maxLevel) {
    issues.push({
      field: 'cumulativeXpByLevel',
      message: 'The threshold count must exactly match the configured maximum Level.',
    })
  }

  for (const [index, threshold] of curve.cumulativeXpByLevel.entries()) {
    if (!Number.isSafeInteger(threshold) || threshold < 0) {
      issues.push({
        field: `cumulativeXpByLevel.${index}`,
        message: 'XP thresholds must be non-negative safe integers.',
      })
      continue
    }

    if (index === 0 && threshold !== 0) {
      issues.push({
        field: 'cumulativeXpByLevel.0',
        message: 'Level 1 must begin at zero cumulative XP.',
      })
    }

    if (index > 0) {
      const previous = curve.cumulativeXpByLevel[index - 1]
      if (typeof previous === 'number' && threshold <= previous) {
        issues.push({
          field: `cumulativeXpByLevel.${index}`,
          message: 'XP thresholds must increase strictly from one Level to the next.',
        })
      }
    }
  }

  return issues
}

export function resolveLevelProgress(totalXp: number, curve: LevelProgressionCurve): LevelProgress {
  assertValidCurve(curve)
  assertSafeNonNegativeXp(totalXp, 'totalXp')

  const thresholds = curve.cumulativeXpByLevel
  let low = 0
  let high = thresholds.length - 1
  let resolvedIndex = 0

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (thresholds[middle] <= totalXp) {
      resolvedIndex = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  const level = resolvedIndex + 1
  const currentLevelThreshold = thresholds[resolvedIndex]
  const nextLevelThreshold = level < curve.maxLevel ? thresholds[resolvedIndex + 1] : null
  const isMaxLevel = level >= curve.maxLevel

  if (isMaxLevel || nextLevelThreshold === null) {
    return {
      curveVersion: curve.version,
      level,
      maxLevel: curve.maxLevel,
      totalXp,
      currentLevelThreshold,
      nextLevelThreshold: null,
      xpIntoLevel: Math.max(0, totalXp - currentLevelThreshold),
      xpRequiredForNextLevel: null,
      progressBasisPoints: XP_PROGRESS_BASIS_POINTS,
      isMaxLevel: true,
    }
  }

  const xpIntoLevel = totalXp - currentLevelThreshold
  const xpRequiredForNextLevel = nextLevelThreshold - currentLevelThreshold
  const progressBasisPoints = Math.min(
    XP_PROGRESS_BASIS_POINTS,
    Math.floor((xpIntoLevel * XP_PROGRESS_BASIS_POINTS) / xpRequiredForNextLevel),
  )

  return {
    curveVersion: curve.version,
    level,
    maxLevel: curve.maxLevel,
    totalXp,
    currentLevelThreshold,
    nextLevelThreshold,
    xpIntoLevel,
    xpRequiredForNextLevel,
    progressBasisPoints,
    isMaxLevel: false,
  }
}

export function resolveXpGrant(
  currentXp: number,
  requestedAmount: number,
  curve: LevelProgressionCurve,
): XpGrantResolution {
  assertValidCurve(curve)
  assertSafeNonNegativeXp(currentXp, 'currentXp')
  if (!Number.isSafeInteger(requestedAmount) || requestedAmount <= 0) {
    throw new RangeError('XP grant amount must be a positive safe integer.')
  }

  const before = resolveLevelProgress(currentXp, curve)
  const capThreshold = curve.cumulativeXpByLevel[curve.maxLevel - 1]
  const remainingToCap = Math.max(0, capThreshold - currentXp)
  const appliedAmount = Math.min(requestedAmount, remainingToCap)
  const xpAfter = currentXp + appliedAmount
  const after = resolveLevelProgress(xpAfter, curve)

  return {
    requestedAmount,
    appliedAmount,
    xpBefore: currentXp,
    xpAfter,
    levelBefore: before.level,
    levelAfter: after.level,
    reachedLevel: after.level > before.level ? after.level : null,
    isMaxLevel: after.isMaxLevel,
  }
}

export function createCharacterLevelUpEvent(input: {
  characterId: string
  progressionCycle: number
  curveVersion: number
  levelBefore: number
  levelAfter: number
}): CharacterLevelUpEvent | null {
  if (input.levelAfter <= input.levelBefore) {
    return null
  }

  return {
    event: 'character_level_up',
    characterId: input.characterId,
    progressionCycle: input.progressionCycle,
    curveVersion: input.curveVersion,
    levelBefore: input.levelBefore,
    levelAfter: input.levelAfter,
  }
}

function assertValidCurve(curve: LevelProgressionCurve): void {
  const issues = validateLevelProgressionCurve(curve)
  if (issues.length > 0) {
    throw new Error(`Invalid Level progression curve: ${issues[0].field}: ${issues[0].message}`)
  }
}

function assertSafeNonNegativeXp(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer.`)
  }
}
