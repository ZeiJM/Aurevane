import { describe, expect, it } from 'vitest'

import {
  PHASE4_BALANCE_LEVELS,
  buildPhase4BalanceHarness,
  type Phase4BalanceDisciplineReport,
} from './phase4-balance-harness'

function allNumbers(value: unknown): number[] {
  if (typeof value === 'number') return [value]
  if (Array.isArray(value)) return value.flatMap(allNumbers)
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(allNumbers)
  }
  return []
}

describe('A03 Phase 4 balance harness', () => {
  it('covers all 17 published Disciplines at Levels 25, 50 and 100', () => {
    const report = buildPhase4BalanceHarness()

    expect(PHASE4_BALANCE_LEVELS).toEqual([25, 50, 100])
    expect(report.disciplines).toHaveLength(17)
    expect(new Set(report.disciplines.map((row) => row.disciplineId)).size).toBe(17)

    for (const discipline of report.disciplines) {
      expect(discipline.scenarios).toHaveLength(6)
      expect(new Set(discipline.scenarios.map((row) => row.level))).toEqual(
        new Set(PHASE4_BALANCE_LEVELS),
      )
      expect(new Set(discipline.scenarios.map((row) => row.allocation))).toEqual(
        new Set(['balanced', 'offensive']),
      )
    }
  })

  it('keeps every numeric output finite and deterministic', () => {
    const first = buildPhase4BalanceHarness()
    const second = buildPhase4BalanceHarness()

    expect(second).toEqual(first)
    for (const value of allNumbers(first)) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('reports role dimensions instead of a hidden aggregate power score', () => {
    const report = buildPhase4BalanceHarness()

    for (const discipline of report.disciplines) {
      expect('powerScore' in (discipline as Phase4BalanceDisciplineReport & { powerScore?: number }))
        .toBe(false)
      for (const scenario of discipline.scenarios) {
        expect(scenario.metrics).toEqual(
          expect.objectContaining({
            bestDirectDamagePer100Ap: expect.any(Number),
            bestSetupPayoffDamagePer100Ap: expect.any(Number),
            bestHealingPer100Ap: expect.any(Number),
            bestProtectionBasisPoints: expect.any(Number),
            bestControlApSwing: expect.any(Number),
            maximumRange: expect.any(Number),
            maximumAreaTargets: expect.any(Number),
            currentMpSpendMaximum: expect.any(Number),
            currentMpRecoveryMaximum: expect.any(Number),
            repeatDamageEfficiencyRatio: expect.any(Number),
          }),
        )
      }
      expect(discipline.essence).toEqual(
        expect.objectContaining({
          directDamagePer100Ap: expect.any(Number),
          healingPer100Ap: expect.any(Number),
          protectionBasisPoints: expect.any(Number),
          controlApSwing: expect.any(Number),
        }),
      )
      expect(discipline.resonance).toEqual(
        expect.objectContaining({
          pairCount: 16,
          averageBonusDamage: expect.any(Number),
          maximumBonusDamage: expect.any(Number),
        }),
      )
    }
  })

  it('preserves distinct support/control dimensions for non-DPS roles', () => {
    const report = buildPhase4BalanceHarness()
    const byId = new Map(report.disciplines.map((row) => [row.disciplineId, row]))

    const lifebinder = byId.get('lifebinder')
    const bastion = byId.get('bastion')
    const frostweaver = byId.get('frostweaver')
    if (!lifebinder || !bastion || !frostweaver) throw new Error('Expected role fixtures.')

    expect(
      Math.max(...lifebinder.scenarios.map((row) => row.metrics.bestHealingPer100Ap)),
    ).toBeGreaterThan(0)
    expect(
      Math.max(...bastion.scenarios.map((row) => row.metrics.bestProtectionBasisPoints)),
    ).toBeGreaterThan(0)
    expect(
      Math.max(...frostweaver.scenarios.map((row) => row.metrics.bestControlApSwing)),
    ).toBeGreaterThan(0)
  })
})
