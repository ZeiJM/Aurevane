import { describe, expect, it } from 'vitest'

import {
  DISCIPLINE_INSIGHT_THRESHOLDS,
  DISCIPLINE_LEVEL_MAX,
  DISCIPLINE_MASTERY_CAPACITY,
  checkDisciplineAdvance,
  disciplineInsightRequiredForLevel,
  disciplineLevelForInsight,
  disciplineMasteryCapacityRemaining,
  disciplineMasteryCapacityUsed,
  isDisciplineSkillUnlocked,
  type DisciplineProgressionState,
} from './discipline-progression'

function progression(disciplineId: string, level: number, insight = 0): DisciplineProgressionState {
  return { disciplineId, level, insight }
}

describe('Discipline progression', () => {
  it('maps cumulative Insight to Discipline Levels 1 through 8', () => {
    expect(DISCIPLINE_INSIGHT_THRESHOLDS).toEqual([0, 100, 250, 450, 700, 1000, 1350, 1750])
    expect(disciplineLevelForInsight(0)).toBe(1)
    expect(disciplineLevelForInsight(99)).toBe(1)
    expect(disciplineLevelForInsight(100)).toBe(2)
    expect(disciplineLevelForInsight(1749)).toBe(7)
    expect(disciplineLevelForInsight(1750)).toBe(8)
    expect(disciplineInsightRequiredForLevel(8)).toBe(1750)
  })

  it('uses one Mastery Capacity point for every Discipline Level above 1', () => {
    const fourMastered = [
      progression('vanguard', 8),
      progression('farstrider', 8),
      progression('shadehand', 8),
      progression('ironfist', 8),
      progression('aetherist', 1),
      progression('lifebinder', 1),
    ]

    expect(DISCIPLINE_MASTERY_CAPACITY).toBe(28)
    expect(disciplineMasteryCapacityUsed(fourMastered)).toBe(28)
    expect(disciplineMasteryCapacityRemaining(fourMastered)).toBe(0)
  })

  it('allows a ready advance only when both Insight and capacity permit it', () => {
    const current = progression('vanguard', 2, 250)
    const states = [current, progression('farstrider', 1)]

    expect(checkDisciplineAdvance(current, states)).toMatchObject({
      allowed: true,
      reason: 'ready',
      nextLevel: 3,
      insightRequired: 250,
    })
  })

  it('blocks advancement when Mastery Capacity is exhausted', () => {
    const current = progression('aetherist', 1, 100)
    const states = [
      progression('vanguard', 8),
      progression('farstrider', 8),
      progression('shadehand', 8),
      progression('ironfist', 8),
      current,
    ]

    expect(checkDisciplineAdvance(current, states)).toMatchObject({
      allowed: false,
      reason: 'mastery-capacity-exhausted',
      masteryCapacityUsed: 28,
      masteryCapacityRemaining: 0,
    })
  })

  it('keeps real progression separate from the testing skill unlock bypass', () => {
    expect(isDisciplineSkillUnlocked(DISCIPLINE_LEVEL_MAX, 1)).toBe(true)
    expect(isDisciplineSkillUnlocked(DISCIPLINE_LEVEL_MAX, 1, false)).toBe(false)
    expect(isDisciplineSkillUnlocked(3, 3, false)).toBe(true)
  })

  it('rejects invalid Levels and Insight values', () => {
    expect(() => disciplineInsightRequiredForLevel(0)).toThrow(RangeError)
    expect(() => disciplineInsightRequiredForLevel(9)).toThrow(RangeError)
    expect(() => disciplineLevelForInsight(-1)).toThrow(RangeError)
  })
})
