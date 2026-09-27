import { describe, expect, it } from 'vitest'

import { latestEnabledMatureSkills, resolveMatureSkillVersion } from './mature-skills'
import { rebalanceMatureSkillDefinition } from './skill-balance-v5'

describe('owner v5 Skill rebalance', () => {
  it('publishes all current regular Techniques with bounded power, duration, and cooldown rules', () => {
    const skills = latestEnabledMatureSkills()
    expect(skills).toHaveLength(136)

    for (const skill of skills) {
      expect(skill.authoring.validationTags).toContain('owner-rebalance-v5')
      expect(skill.flavorLine?.trim().length).toBeGreaterThan(0)
      if (skill.requirements.length > 0) {
        expect(skill.cooldown).toBeNull()
      } else {
        expect(skill.cooldown?.ownerTurns).toBeGreaterThanOrEqual(1)
        expect(skill.cooldown?.ownerTurns).toBeLessThanOrEqual(3)
      }

      for (const effect of skill.effects) {
        expect(effect.durationTurns).toBeDefined()
        expect(effect.durationTurns).toBeGreaterThanOrEqual(0)
        expect(effect.durationTurns).toBeLessThanOrEqual(4)
        if (effect.type === 'damage') {
          expect(effect.amount).toBeGreaterThanOrEqual(effect.vengeance ? 0 : 1)
          expect(effect.amount).toBeLessThanOrEqual(20)
          expect(effect.durationTurns).toBe(0)
        }
        if (effect.type === 'healing' || effect.type === 'barrier-change') {
          expect(effect.amount).toBeGreaterThanOrEqual(1)
          expect(effect.amount).toBeLessThanOrEqual(20)
        }
        if (effect.type === 'resource-change') {
          expect(Math.abs(effect.delta)).toBeGreaterThanOrEqual(1)
          expect(Math.abs(effect.delta)).toBeLessThanOrEqual(20)
        }
        if (effect.power !== undefined) {
          expect(effect.power).toBeGreaterThanOrEqual(1)
          expect(effect.power).toBeLessThanOrEqual(20)
        }
      }
    }
  })

  it('makes the same plain attack stronger when AP rises without linear runaway', () => {
    const base = resolveMatureSkillVersion('vanguard.forceful-strike', 2)
    if (!base) throw new Error('Expected historical Forceful Strike.')

    const low = rebalanceMatureSkillDefinition({ ...base, apCost: 30 })
    const high = rebalanceMatureSkillDefinition({ ...base, apCost: 60 })
    const lowDamage = low.effects.find((effect) => effect.type === 'damage')
    const highDamage = high.effects.find((effect) => effect.type === 'damage')
    if (lowDamage?.type !== 'damage' || highDamage?.type !== 'damage') {
      throw new Error('Expected damage effects.')
    }

    expect(highDamage.amount).toBeGreaterThan(lowDamage.amount)
    expect(highDamage.amount).toBeLessThanOrEqual(20)
    expect(highDamage.amount / lowDamage.amount).toBeLessThan(2.5)
  })

  it('prices persistent duration into cooldown strength', () => {
    const base = resolveMatureSkillVersion('vanguard.brace', 1)
    if (!base) throw new Error('Expected historical Brace.')
    const ungated = { ...base, requirements: [] }

    const short = rebalanceMatureSkillDefinition({
      ...ungated,
      effects: ungated.effects.map((effect) => ({ ...effect, durationTurns: 1 })),
    })
    const long = rebalanceMatureSkillDefinition({
      ...ungated,
      effects: ungated.effects.map((effect) => ({ ...effect, durationTurns: 4 })),
    })

    expect(long.cooldown?.ownerTurns ?? 0).toBeGreaterThanOrEqual(short.cooldown?.ownerTurns ?? 0)
  })

  it('gives prerequisite-gated Skills no cooldown', () => {
    const payoff = resolveMatureSkillVersion('runeblade.rune-burst')
    if (!payoff) throw new Error('Expected Rune Burst.')
    expect(payoff.requirements.length).toBeGreaterThan(0)
    expect(payoff.cooldown).toBeNull()
  })
})
