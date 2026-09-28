import { describe, expect, it } from 'vitest'

import { resolveMatureSkillVersion } from './mature-skills'
import {
  classifyV51SkillRole,
  rebalanceMatureSkillDefinitionV51,
  v51TargetingMagnitudeFactor,
  v51TargetingValueWeight,
} from './skill-balance-v5-1'

function historicalSkill(id: string) {
  const definition = resolveMatureSkillVersion(id)
  if (!definition) throw new Error(`Expected current Skill ${id}.`)
  return definition
}

describe('Combat v5.1 Skill balance primitives', () => {
  it('classifies Attack, HP Recovery, and MP-only recovery into the intended AP roles', () => {
    expect(classifyV51SkillRole(historicalSkill('vanguard.forceful-strike'))).toBe('attack')
    expect(classifyV51SkillRole(historicalSkill('lifebinder.mending-light'))).toBe('recovery')
    expect(classifyV51SkillRole(historicalSkill('aetherist.channel'))).toBe('utility')
  })

  it('clamps regular Technique AP to the approved role bands', () => {
    const attack = historicalSkill('vanguard.forceful-strike')
    const recovery = historicalSkill('lifebinder.mending-light')
    const utility = historicalSkill('aetherist.channel')

    expect(rebalanceMatureSkillDefinitionV51({ ...attack, apCost: 25 }).apCost).toBe(45)
    expect(rebalanceMatureSkillDefinitionV51({ ...attack, apCost: 80 }).apCost).toBe(60)
    expect(rebalanceMatureSkillDefinitionV51({ ...recovery, apCost: 25 }).apCost).toBe(45)
    expect(rebalanceMatureSkillDefinitionV51({ ...recovery, apCost: 80 }).apCost).toBe(60)
    expect(rebalanceMatureSkillDefinitionV51({ ...utility, apCost: 20 }).apCost).toBe(35)
    expect(rebalanceMatureSkillDefinitionV51({ ...utility, apCost: 70 }).apCost).toBe(50)
  })

  it('rewards short reach and prices long reach around range 3', () => {
    const base = historicalSkill('vanguard.forceful-strike')
    const factor = (maximumRange: number) =>
      v51TargetingMagnitudeFactor({
        ...base,
        target: {
          ...base.target,
          minimumRange: 1,
          maximumRange,
          requiresLineOfSight: true,
          maximumElevationDifference: 0,
        },
      })

    expect(factor(1)).toBeGreaterThan(factor(2))
    expect(factor(2)).toBeGreaterThan(factor(3))
    expect(factor(3)).toBeGreaterThan(factor(4))
    expect(factor(4)).toBeGreaterThan(factor(5))
    expect(factor(3)).toBeCloseTo(1, 6)
  })

  it('prices elevation reach and line-of-sight bypass into magnitude and value', () => {
    const base = historicalSkill('vanguard.forceful-strike')
    const definition = {
      ...base,
      target: {
        ...base.target,
        minimumRange: 1,
        maximumRange: 3,
        requiresLineOfSight: true,
        maximumElevationDifference: 0,
      },
    }

    const elevationOne = {
      ...definition,
      target: { ...definition.target, maximumElevationDifference: 1 },
    }
    const elevationTwo = {
      ...definition,
      target: { ...definition.target, maximumElevationDifference: 2 },
    }
    const noLos = {
      ...definition,
      target: { ...definition.target, requiresLineOfSight: false },
    }

    expect(v51TargetingMagnitudeFactor(elevationOne)).toBeLessThan(
      v51TargetingMagnitudeFactor(definition),
    )
    expect(v51TargetingMagnitudeFactor(elevationTwo)).toBeLessThan(
      v51TargetingMagnitudeFactor(elevationOne),
    )
    expect(v51TargetingMagnitudeFactor(noLos)).toBeLessThan(v51TargetingMagnitudeFactor(definition))

    expect(v51TargetingValueWeight(elevationOne)).toBeGreaterThan(
      v51TargetingValueWeight(definition),
    )
    expect(v51TargetingValueWeight(elevationTwo)).toBeGreaterThan(
      v51TargetingValueWeight(elevationOne),
    )
    expect(v51TargetingValueWeight(noLos)).toBeGreaterThan(v51TargetingValueWeight(definition))
  })

  it('does not charge self-target Skills for irrelevant line-of-sight settings', () => {
    const base = historicalSkill('aetherist.channel')
    expect(base.target.kind).toBe('self')

    const ordinary = v51TargetingMagnitudeFactor(base)
    const artificialLos = v51TargetingMagnitudeFactor({
      ...base,
      target: { ...base.target, requiresLineOfSight: true },
    })

    expect(ordinary).toBe(artificialLos)
  })

  it('gives otherwise-equal direct attacks less Power as targeting advantages increase', () => {
    const base = historicalSkill('vanguard.forceful-strike')
    const make = (maximumRange: number, elevation: number, requiresLineOfSight = true) =>
      rebalanceMatureSkillDefinitionV51({
        ...base,
        apCost: 50,
        requirements: [],
        target: {
          ...base.target,
          minimumRange: 1,
          maximumRange,
          requiresLineOfSight,
          maximumElevationDifference: elevation,
          shape: { kind: 'single' },
        },
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 8 }],
      })

    const short = make(1, 0)
    const median = make(3, 0)
    const long = make(5, 0)
    const elevated = make(3, 2)
    const noLos = make(3, 0, false)
    const damage = (definition: typeof short) =>
      definition.effects.find((effect) => effect.type === 'damage')?.amount ?? 0

    expect(damage(short)).toBeGreaterThan(damage(median))
    expect(damage(median)).toBeGreaterThan(damage(long))
    expect(damage(elevated)).toBeLessThan(damage(median))
    expect(damage(noLos)).toBeLessThan(damage(median))
  })
})
