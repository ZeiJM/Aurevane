import { describe, expect, it } from 'vitest'

import {
  BALANCED_PRACTICE_FOCUS,
  PHASE_1_BALANCED_PRACTICE_CONFIG,
  PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG,
  calculateBalancedPractice,
  getPlannedPracticeWindowSeconds,
  resolvePhase1PracticeIntent,
  validateBalancedPracticeConfig,
  validatePlannedPracticeWindowConfig,
  type BalancedPracticeConfig,
} from './wayfarers-practice'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const WINDOW_START_MS = Date.UTC(2026, 7, 1, 12, 0, 0)

function calculateAfter(durationMs: number, config?: BalancedPracticeConfig) {
  return calculateBalancedPractice({
    windowStartMs: WINDOW_START_MS,
    windowEndMs: WINDOW_START_MS + durationMs,
    config,
  })
}

describe("Wayfarer's Practice: Balanced Practice", () => {
  it('ships one valid versioned Balanced Practice configuration', () => {
    expect(validateBalancedPracticeConfig(PHASE_1_BALANCED_PRACTICE_CONFIG)).toEqual([])
    expect(PHASE_1_BALANCED_PRACTICE_CONFIG).toMatchObject({
      version: 1,
      focus: BALANCED_PRACTICE_FOCUS,
      minimumOfflineSeconds: 60 * 60,
      fullRateEndSeconds: 24 * 60 * 60,
      reducedRateEndSeconds: 72 * 60 * 60,
      restedMomentumEndSeconds: 14 * 24 * 60 * 60,
    })
  })

  it('awards nothing for short reconnects at or below the minimum threshold', () => {
    expect(calculateAfter(30 * 60 * 1000)).toMatchObject({
      thresholdState: 'below_minimum',
      creditedDirectSeconds: 0,
      requestedCharacterXp: 0,
      restedMomentumGain: 0,
    })

    expect(calculateAfter(HOUR_MS)).toMatchObject({
      thresholdState: 'below_minimum',
      requestedCharacterXp: 0,
      restedMomentumGain: 0,
    })
  })

  it('uses the full direct-Practice rate after the threshold through the first day', () => {
    expect(calculateAfter(2 * HOUR_MS)).toMatchObject({
      thresholdState: 'eligible',
      fullRateSeconds: 60 * 60,
      reducedRateSeconds: 0,
      requestedCharacterXp: 8,
      directXpCapState: 'not_reached',
    })

    expect(calculateAfter(DAY_MS)).toMatchObject({
      fullRateSeconds: 23 * 60 * 60,
      reducedRateSeconds: 0,
      requestedCharacterXp: 184,
    })
  })

  it('uses the reduced rate from one day through three days and then caps direct XP', () => {
    expect(calculateAfter(2 * DAY_MS)).toMatchObject({
      fullRateSeconds: 23 * 60 * 60,
      reducedRateSeconds: 24 * 60 * 60,
      requestedCharacterXp: 280,
      directXpCapState: 'not_reached',
    })

    expect(calculateAfter(3 * DAY_MS)).toMatchObject({
      fullRateSeconds: 23 * 60 * 60,
      reducedRateSeconds: 48 * 60 * 60,
      requestedCharacterXp: 376,
      directXpCapState: 'reached',
      restedMomentumGain: 0,
    })

    expect(calculateAfter(8 * DAY_MS).requestedCharacterXp).toBe(376)
  })

  it('builds bounded Rested Momentum after direct Practice has banked', () => {
    const fourteenDays = calculateAfter(14 * DAY_MS)
    const twentyDays = calculateAfter(20 * DAY_MS)

    expect(fourteenDays).toMatchObject({
      restedMomentumSeconds: 11 * 24 * 60 * 60,
      restedMomentumGain: 132,
      restedMomentumCapState: 'reached',
    })
    expect(twentyDays).toMatchObject({
      requestedCharacterXp: 376,
      restedMomentumGain: 132,
      restedMomentumCapState: 'reached',
    })
  })

  it('honors lower data-driven caps without changing the time-window algorithm', () => {
    const tunedConfig: BalancedPracticeConfig = {
      ...PHASE_1_BALANCED_PRACTICE_CONFIG,
      version: 2,
      directXpCap: 100,
      restedMomentumCap: 10,
    }

    expect(calculateAfter(14 * DAY_MS, tunedConfig)).toMatchObject({
      configVersion: 2,
      requestedCharacterXp: 100,
      directXpCapState: 'reached',
      restedMomentumGain: 10,
      restedMomentumCapState: 'reached',
    })
  })

  it('is deterministic and independent of caller timezone representation', () => {
    const instantFromUtc = Date.parse('2026-08-01T12:00:00Z')
    const instantFromOffset = Date.parse('2026-08-01T08:00:00-04:00')

    expect(instantFromUtc).toBe(instantFromOffset)

    const first = calculateBalancedPractice({
      windowStartMs: instantFromUtc,
      windowEndMs: instantFromUtc + 2 * DAY_MS,
    })
    const second = calculateBalancedPractice({
      windowStartMs: instantFromOffset,
      windowEndMs: instantFromOffset + 2 * DAY_MS,
    })

    expect(second).toEqual(first)
  })

  it('returns only Phase 1 practice reward categories', () => {
    const result = calculateAfter(14 * DAY_MS)

    expect(Object.keys(result).sort()).toEqual(
      [
        'configVersion',
        'creditedDirectSeconds',
        'directXpCapState',
        'focus',
        'fullRateSeconds',
        'reducedRateSeconds',
        'requestedCharacterXp',
        'restedMomentumCapState',
        'restedMomentumGain',
        'restedMomentumSeconds',
        'thresholdState',
        'window',
      ].sort(),
    )

    for (const prohibitedProperty of [
      'quest',
      'story',
      'boss',
      'expedition',
      'pvp',
      'equipment',
      'currency',
      'discipline',
    ]) {
      expect(result).not.toHaveProperty(prohibitedProperty)
    }
  })

  it('rejects malformed configuration and untrusted time windows', () => {
    const invalidConfig: BalancedPracticeConfig = {
      ...PHASE_1_BALANCED_PRACTICE_CONFIG,
      fullRateEndSeconds: PHASE_1_BALANCED_PRACTICE_CONFIG.minimumOfflineSeconds,
      reducedRateXpPerHour: PHASE_1_BALANCED_PRACTICE_CONFIG.fullRateXpPerHour + 1,
    }

    expect(validateBalancedPracticeConfig(invalidConfig)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'fullRateEndSeconds' }),
        expect.objectContaining({ field: 'reducedRateXpPerHour' }),
      ]),
    )
    expect(() => calculateAfter(2 * DAY_MS, invalidConfig)).toThrow(
      'Invalid Balanced Practice config',
    )
    expect(() =>
      calculateBalancedPractice({
        windowStartMs: WINDOW_START_MS,
        windowEndMs: WINDOW_START_MS - 1,
      }),
    ).toThrow(RangeError)
    expect(() =>
      calculateBalancedPractice({
        windowStartMs: Number.MAX_VALUE,
        windowEndMs: Number.MAX_VALUE,
      }),
    ).toThrow(RangeError)
  })
})

describe("Wayfarer's Practice: planned one-absence intent", () => {
  it('ships exactly the approved Short, Overnight, and Extended data-driven targets', () => {
    expect(validatePlannedPracticeWindowConfig(PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG)).toEqual([])
    expect(PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG).toEqual({
      version: 1,
      shortSeconds: 3 * 60 * 60,
      overnightSeconds: 8 * 60 * 60,
      extendedSeconds: 24 * 60 * 60,
    })
    expect(getPlannedPracticeWindowSeconds('short')).toBe(3 * 60 * 60)
    expect(getPlannedPracticeWindowSeconds('overnight')).toBe(8 * 60 * 60)
    expect(getPlannedPracticeWindowSeconds('extended')).toBe(24 * 60 * 60)
  })

  it('credits an early return only for legitimate elapsed time', () => {
    expect(
      resolvePhase1PracticeIntent({ elapsedSeconds: 2 * 60 * 60, plannedWindow: 'overnight' }),
    ).toEqual({
      source: 'planned_balanced',
      plannedWindow: 'overnight',
      plannedWindowConfigVersion: 1,
      plannedWindowSeconds: 8 * 60 * 60,
      plannedElapsedSeconds: 2 * 60 * 60,
      balancedFallbackSeconds: 0,
    })
  })

  it('ends the explicit plan at its boundary and records the remaining absence as Balanced fallback', () => {
    expect(
      resolvePhase1PracticeIntent({ elapsedSeconds: 12 * 60 * 60, plannedWindow: 'overnight' }),
    ).toMatchObject({
      source: 'planned_balanced',
      plannedWindow: 'overnight',
      plannedElapsedSeconds: 8 * 60 * 60,
      balancedFallbackSeconds: 4 * 60 * 60,
    })
  })

  it('uses automatic Balanced Practice for the whole absence when no plan exists', () => {
    expect(
      resolvePhase1PracticeIntent({ elapsedSeconds: 9 * 60 * 60, plannedWindow: null }),
    ).toEqual({
      source: 'automatic_balanced',
      plannedWindow: null,
      plannedWindowConfigVersion: null,
      plannedWindowSeconds: null,
      plannedElapsedSeconds: 0,
      balancedFallbackSeconds: 9 * 60 * 60,
    })
  })

  it('has no legacy Until I Return state and rejects malformed elapsed time/config', () => {
    expect(['short', 'overnight', 'extended']).not.toContain('until_i_return')
    expect(() =>
      resolvePhase1PracticeIntent({ elapsedSeconds: -1, plannedWindow: 'short' }),
    ).toThrow(RangeError)
    expect(
      validatePlannedPracticeWindowConfig({
        ...PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG,
        overnightSeconds: 2 * 60 * 60,
      }),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'overnightSeconds' })]))
  })
})
