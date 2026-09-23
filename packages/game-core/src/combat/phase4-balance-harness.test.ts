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
      expect(
        'powerScore' in (discipline as Phase4BalanceDisciplineReport & { powerScore?: number }),
      ).toBe(false)
      for (const scenario of discipline.scenarios) {
        expect(scenario.metrics).toEqual(
          expect.objectContaining({
            basicAttackDamagePer100Ap: expect.any(Number),
            bestDirectDamagePer100Ap: expect.any(Number),
            bestPositionalDamagePer100Ap: expect.any(Number),
            bestAttritionDamagePer100Ap: expect.any(Number),
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

  it('keeps authored class pressure above the universal Basic Attack in representative offensive builds', () => {
    const report = buildPhase4BalanceHarness()
    for (const discipline of report.disciplines) {
      const metrics = discipline.scenarios.find(
        (scenario) => scenario.level === 100 && scenario.allocation === 'offensive',
      )?.metrics
      if (!metrics || metrics.bestDirectDamagePer100Ap === 0) continue
      expect(
        Math.max(
          metrics.bestDirectDamagePer100Ap,
          metrics.bestPositionalDamagePer100Ap,
          metrics.bestAttritionDamagePer100Ap,
        ),
      ).toBeGreaterThan(metrics.basicAttackDamagePer100Ap)
    }
  })

  it('measures setup-payoff pressure across the combined setup and payoff AP budget', () => {
    const report = buildPhase4BalanceHarness()
    const byId = new Map(report.disciplines.map((row) => [row.disciplineId, row]))
    const ironfist = byId.get('ironfist')
    const frostweaver = byId.get('frostweaver')
    if (!ironfist || !frostweaver) throw new Error('Expected setup-payoff fixtures.')

    for (const discipline of [ironfist, frostweaver]) {
      const metrics = discipline.scenarios.find(
        (scenario) => scenario.level === 100 && scenario.allocation === 'offensive',
      )?.metrics
      if (!metrics) throw new Error('Expected Level-100 offensive setup-payoff metrics.')
      expect(metrics.bestSetupPayoffDamagePer100Ap).toBeGreaterThan(0)
      expect(metrics.bestSetupPayoffDamagePer100Ap).toBeLessThan(metrics.bestDirectDamagePer100Ap)
      expect(metrics.bestSetupPayoffDamagePer100Ap).toBeGreaterThan(
        metrics.basicAttackDamagePer100Ap,
      )
    }
  })

  it('keeps the Edgedancer pure Essence competitive without replacing positional mastery', () => {
    const report = buildPhase4BalanceHarness()
    const edgedancer = report.disciplines.find((row) => row.disciplineId === 'edgedancer')
    const metrics = edgedancer?.scenarios.find(
      (scenario) => scenario.level === 100 && scenario.allocation === 'offensive',
    )?.metrics
    if (!edgedancer || !metrics) throw new Error('Expected Level-100 Edgedancer balance fixture.')

    expect(edgedancer.essence.directDamagePer100Ap).toBeGreaterThanOrEqual(
      metrics.bestDirectDamagePer100Ap * 0.9,
    )
    expect(edgedancer.essence.directDamagePer100Ap).toBeLessThan(
      metrics.bestPositionalDamagePer100Ap,
    )
  })

  it('captures positional and attrition identities separately from front-facing direct damage', () => {
    const report = buildPhase4BalanceHarness()
    const byId = new Map(report.disciplines.map((row) => [row.disciplineId, row]))
    const shadehand = byId.get('shadehand')
    const edgedancer = byId.get('edgedancer')
    const cinderweaver = byId.get('cinderweaver')
    const ravager = byId.get('ravager')
    if (!shadehand || !edgedancer || !cinderweaver || !ravager) {
      throw new Error('Expected positional/attrition fixtures.')
    }

    for (const discipline of [shadehand, edgedancer]) {
      expect(
        Math.max(...discipline.scenarios.map((row) => row.metrics.bestPositionalDamagePer100Ap)),
      ).toBeGreaterThan(
        Math.max(...discipline.scenarios.map((row) => row.metrics.bestDirectDamagePer100Ap)),
      )
    }
    for (const discipline of [cinderweaver, ravager]) {
      expect(
        Math.max(...discipline.scenarios.map((row) => row.metrics.bestAttritionDamagePer100Ap)),
      ).toBeGreaterThanOrEqual(
        Math.max(...discipline.scenarios.map((row) => row.metrics.bestDirectDamagePer100Ap)),
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
