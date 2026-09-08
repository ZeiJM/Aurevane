export const DISCIPLINE_LEVEL_MIN = 1 as const
export const DISCIPLINE_LEVEL_MAX = 8 as const

/**
 * Discipline progression is intentionally separate from character XP.
 *
 * Level 1 is the baseline attunement and therefore consumes no Mastery Capacity. Each advancement
 * above Level 1 consumes one capacity point. A capacity of 28 lets a character fully master four
 * Disciplines (4 × 7) while preventing one character from mastering every Foundation Discipline.
 */
export const DISCIPLINE_MASTERY_CAPACITY = 28 as const

/** Cumulative Discipline Insight required to qualify for each Discipline Level, index = level - 1. */
export const DISCIPLINE_INSIGHT_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1350, 1750] as const

/**
 * Testing-phase policy: every currently authored Discipline is selectable and every authored
 * Discipline Skill may be exercised regardless of the character's real Discipline Level.
 *
 * This is presentation/loadout access only. Real Discipline Level and Insight are still persisted
 * and must never be silently promoted to Level 8 because testing access is enabled.
 */
export const DISCIPLINES_UNLOCKED_FOR_TESTING = true as const
export const DISCIPLINE_SKILLS_UNLOCKED_FOR_TESTING = true as const

export interface DisciplineProgressionState {
  disciplineId: string
  level: number
  insight: number
}

export interface DisciplineAdvanceCheck {
  allowed: boolean
  reason:
    | 'ready'
    | 'maximum-level'
    | 'insufficient-insight'
    | 'mastery-capacity-exhausted'
  nextLevel: number | null
  insightRequired: number | null
  masteryCapacityUsed: number
  masteryCapacityRemaining: number
}

export function disciplineInsightRequiredForLevel(level: number): number {
  assertDisciplineLevel(level)
  return DISCIPLINE_INSIGHT_THRESHOLDS[level - 1]
}

export function disciplineLevelForInsight(insight: number): number {
  assertInsight(insight)
  let resolved = DISCIPLINE_LEVEL_MIN
  for (let level = DISCIPLINE_LEVEL_MIN + 1; level <= DISCIPLINE_LEVEL_MAX; level += 1) {
    if (insight < disciplineInsightRequiredForLevel(level)) break
    resolved = level
  }
  return resolved
}

export function disciplineMasteryCapacityCost(level: number): number {
  assertDisciplineLevel(level)
  return level - DISCIPLINE_LEVEL_MIN
}

export function disciplineMasteryCapacityUsed(
  progressions: readonly Pick<DisciplineProgressionState, 'level'>[],
): number {
  return progressions.reduce(
    (total, progression) => total + disciplineMasteryCapacityCost(progression.level),
    0,
  )
}

export function disciplineMasteryCapacityRemaining(
  progressions: readonly Pick<DisciplineProgressionState, 'level'>[],
): number {
  return Math.max(0, DISCIPLINE_MASTERY_CAPACITY - disciplineMasteryCapacityUsed(progressions))
}

export function checkDisciplineAdvance(
  progression: DisciplineProgressionState,
  allProgressions: readonly DisciplineProgressionState[],
): DisciplineAdvanceCheck {
  assertProgression(progression)
  for (const entry of allProgressions) assertProgression(entry)

  const capacityUsed = disciplineMasteryCapacityUsed(allProgressions)
  const capacityRemaining = Math.max(0, DISCIPLINE_MASTERY_CAPACITY - capacityUsed)

  if (progression.level >= DISCIPLINE_LEVEL_MAX) {
    return {
      allowed: false,
      reason: 'maximum-level',
      nextLevel: null,
      insightRequired: null,
      masteryCapacityUsed: capacityUsed,
      masteryCapacityRemaining: capacityRemaining,
    }
  }

  const nextLevel = progression.level + 1
  const insightRequired = disciplineInsightRequiredForLevel(nextLevel)
  if (progression.insight < insightRequired) {
    return {
      allowed: false,
      reason: 'insufficient-insight',
      nextLevel,
      insightRequired,
      masteryCapacityUsed: capacityUsed,
      masteryCapacityRemaining: capacityRemaining,
    }
  }

  if (capacityRemaining < 1) {
    return {
      allowed: false,
      reason: 'mastery-capacity-exhausted',
      nextLevel,
      insightRequired,
      masteryCapacityUsed: capacityUsed,
      masteryCapacityRemaining: capacityRemaining,
    }
  }

  return {
    allowed: true,
    reason: 'ready',
    nextLevel,
    insightRequired,
    masteryCapacityUsed: capacityUsed,
    masteryCapacityRemaining: capacityRemaining,
  }
}

export function isDisciplineSkillUnlocked(
  requiredDisciplineLevel: number,
  currentDisciplineLevel: number,
  testingUnlock = DISCIPLINE_SKILLS_UNLOCKED_FOR_TESTING,
): boolean {
  assertDisciplineLevel(requiredDisciplineLevel)
  assertDisciplineLevel(currentDisciplineLevel)
  return testingUnlock || requiredDisciplineLevel <= currentDisciplineLevel
}

function assertProgression(progression: DisciplineProgressionState): void {
  if (!progression.disciplineId.trim()) throw new RangeError('Discipline id is required.')
  assertDisciplineLevel(progression.level)
  assertInsight(progression.insight)
}

function assertDisciplineLevel(level: number): void {
  if (!Number.isInteger(level) || level < DISCIPLINE_LEVEL_MIN || level > DISCIPLINE_LEVEL_MAX) {
    throw new RangeError(
      `Discipline Level must be a whole number from ${DISCIPLINE_LEVEL_MIN} to ${DISCIPLINE_LEVEL_MAX}.`,
    )
  }
}

function assertInsight(insight: number): void {
  if (!Number.isSafeInteger(insight) || insight < 0) {
    throw new RangeError('Discipline Insight must be a non-negative safe integer.')
  }
}
