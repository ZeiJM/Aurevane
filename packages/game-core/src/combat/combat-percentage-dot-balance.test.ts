import { describe, expect, it } from 'vitest'
import { buildPercentageDotBalanceReport } from './combat-percentage-dot-balance'
import {
  validateAttributeAllocation,
  foundationDisciplineAttributePolicy,
} from '../character/attribute-allocation'

describe('percentage DoT legal-build balance evidence', () => {
  it('measures four legal builds with actual seeded hit, resistance, cooldown and AP resolution', () => {
    const report = buildPercentageDotBalanceReport(12)
    expect(report.builds).toHaveLength(4)
    for (const build of report.builds) {
      expect(build.skills).toHaveLength(4)
      expect(new Set(build.skills).size).toBe(4)
      expect(
        validateAttributeAllocation({
          attributes: build.attributes,
          level: 100,
          policy: foundationDisciplineAttributePolicy(build.discipline),
          requireFullPool: true,
        }),
      ).toEqual([])
      expect(build.rounds).toHaveLength(12)
      expect(
        build.rounds.every((round) => Number.isSafeInteger(round) && round > 0 && round <= 100),
      ).toBe(true)
    }
    expect(report.skills).toHaveLength(9)
    for (const skill of report.skills) {
      expect(skill.highHp.directHp).toBeGreaterThan(0)
      expect(skill.highHp.tickHp, skill.id).toBeGreaterThan(0)
      expect(skill.lowHp.directHp).toBeLessThanOrEqual(3 * skill.lowHp.targets)
      expect(skill.lowHp.tickHp).toBe(0)
      expect(skill.apCost).toBeGreaterThan(0)
    }
  }, 60000)
})
