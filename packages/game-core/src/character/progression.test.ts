import { describe, expect, it } from 'vitest'

import {
  createCharacterLevelUpEvent,
  resolveLevelProgress,
  resolveXpGrant,
  validateLevelProgressionCurve,
  type LevelProgressionCurve,
} from './progression'

function testCurve(): LevelProgressionCurve {
  return {
    version: 7,
    maxLevel: 100,
    cumulativeXpByLevel: Array.from({ length: 100 }, (_, index) => index * 100),
  }
}

describe('Level and XP progression', () => {
  it('resolves cumulative XP into Levels and next-Level progress', () => {
    const levelOne = resolveLevelProgress(0, testCurve())
    const levelTwo = resolveLevelProgress(175, testCurve())

    expect(levelOne).toMatchObject({
      level: 1,
      totalXp: 0,
      currentLevelThreshold: 0,
      nextLevelThreshold: 100,
      xpIntoLevel: 0,
      xpRequiredForNextLevel: 100,
      progressBasisPoints: 0,
      isMaxLevel: false,
    })
    expect(levelTwo).toMatchObject({
      level: 2,
      currentLevelThreshold: 100,
      nextLevelThreshold: 200,
      xpIntoLevel: 75,
      xpRequiredForNextLevel: 100,
      progressBasisPoints: 7500,
    })
  })

  it('caps Level at the curve maximum while tolerating historical excess XP', () => {
    const exactCap = resolveLevelProgress(9900, testCurve())
    const aboveCap = resolveLevelProgress(50_000, testCurve())

    expect(exactCap).toMatchObject({ level: 100, isMaxLevel: true, nextLevelThreshold: null })
    expect(aboveCap).toMatchObject({ level: 100, isMaxLevel: true, totalXp: 50_000 })
  })

  it('applies XP without exceeding the configured cap threshold', () => {
    expect(resolveXpGrant(90, 25, testCurve())).toMatchObject({
      requestedAmount: 25,
      appliedAmount: 25,
      xpBefore: 90,
      xpAfter: 115,
      levelBefore: 1,
      levelAfter: 2,
      reachedLevel: 2,
      isMaxLevel: false,
    })

    expect(resolveXpGrant(9895, 500, testCurve())).toMatchObject({
      requestedAmount: 500,
      appliedAmount: 5,
      xpAfter: 9900,
      levelAfter: 100,
      isMaxLevel: true,
    })

    expect(resolveXpGrant(9900, 500, testCurve())).toMatchObject({
      requestedAmount: 500,
      appliedAmount: 0,
      xpAfter: 9900,
      levelAfter: 100,
      isMaxLevel: true,
    })
  })

  it('emits a Level-up event only when a grant crosses a Level boundary', () => {
    expect(
      createCharacterLevelUpEvent({
        characterId: 'character-1',
        progressionCycle: 1,
        curveVersion: 7,
        levelBefore: 3,
        levelAfter: 4,
      }),
    ).toEqual({
      event: 'character_level_up',
      characterId: 'character-1',
      progressionCycle: 1,
      curveVersion: 7,
      levelBefore: 3,
      levelAfter: 4,
    })

    expect(
      createCharacterLevelUpEvent({
        characterId: 'character-1',
        progressionCycle: 1,
        curveVersion: 7,
        levelBefore: 4,
        levelAfter: 4,
      }),
    ).toBeNull()
  })

  it('rejects malformed curves and unsafe XP inputs', () => {
    expect(validateLevelProgressionCurve(testCurve())).toEqual([])

    const duplicateThreshold = {
      ...testCurve(),
      cumulativeXpByLevel: testCurve().cumulativeXpByLevel.map((value, index) =>
        index === 3 ? 200 : value,
      ),
    }
    const wrongLength = { ...testCurve(), cumulativeXpByLevel: [0, 100] }

    expect(validateLevelProgressionCurve(duplicateThreshold)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('increase strictly') }),
      ]),
    )
    expect(validateLevelProgressionCurve(wrongLength)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'cumulativeXpByLevel' }),
      ]),
    )
    expect(() => resolveLevelProgress(-1, testCurve())).toThrow(RangeError)
    expect(() => resolveXpGrant(0, 0, testCurve())).toThrow(RangeError)
  })
})
