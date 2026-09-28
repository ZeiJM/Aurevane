import { describe, expect, it } from 'vitest'

import { latestEnabledMatureSkills, resolveMatureSkillVersion } from './mature-skills'
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


describe('Combat v5.1 current Technique catalog', () => {
  it('publishes all 136 current Techniques inside the approved AP and range bands', () => {
    const skills = latestEnabledMatureSkills()
    expect(skills).toHaveLength(136)

    for (const skill of skills) {
      expect(skill.authoring.validationTags).toContain('owner-rebalance-v5-1')
      const role = classifyV51SkillRole(skill)
      const [minimumAp, maximumAp] = role === 'utility' ? [35, 50] : [45, 60]
      expect(skill.apCost, skill.id).toBeGreaterThanOrEqual(minimumAp)
      expect(skill.apCost, skill.id).toBeLessThanOrEqual(maximumAp)

      if (skill.target.kind === 'self') {
        expect(skill.target.maximumRange, skill.id).toBe(0)
        expect(skill.target.maximumElevationDifference, skill.id).toBeNull()
      } else {
        expect(skill.target.maximumRange, skill.id).toBeGreaterThanOrEqual(1)
        expect(skill.target.maximumRange, skill.id).toBeLessThanOrEqual(5)
        expect(skill.target.maximumElevationDifference, skill.id).toBeGreaterThanOrEqual(0)
        expect(skill.target.maximumElevationDifference, skill.id).toBeLessThanOrEqual(2)
      }
    }
  })

  it('centers the current non-self range distribution on 3', () => {
    const ranges = latestEnabledMatureSkills()
      .filter((skill) => skill.target.kind !== 'self')
      .map((skill) => skill.target.maximumRange)
      .sort((left, right) => left - right)

    expect(ranges.length).toBeGreaterThan(0)
    expect(ranges[Math.floor(ranges.length / 2)]).toBe(3)
    expect(ranges).toContain(1)
    expect(ranges).toContain(5)
  })

  it('makes elevation reach sparse, with elevation 2 rarer than elevation 1', () => {
    const nonSelf = latestEnabledMatureSkills().filter((skill) => skill.target.kind !== 'self')
    const counts = new Map<number, number>([
      [0, 0],
      [1, 0],
      [2, 0],
    ])
    const elevatedDisciplines = new Set<string>()
    const allDisciplines = new Set(nonSelf.map((skill) => skill.sourceDisciplineId))

    for (const skill of nonSelf) {
      const elevation = skill.target.maximumElevationDifference ?? 0
      counts.set(elevation, (counts.get(elevation) ?? 0) + 1)
      if (elevation > 0) elevatedDisciplines.add(skill.sourceDisciplineId)
    }

    expect(counts.get(0) ?? 0).toBeGreaterThan(counts.get(1) ?? 0)
    expect(counts.get(1) ?? 0).toBeGreaterThan(counts.get(2) ?? 0)
    expect(counts.get(2) ?? 0).toBeGreaterThan(0)
    expect(elevatedDisciplines.size).toBeLessThan(allDisciplines.size)
  })

  it('uses explicit sparse elevation and reach examples', () => {
    expect(resolveMatureSkillVersion('vanguard.forceful-strike')?.target).toMatchObject({
      maximumRange: 1,
      maximumElevationDifference: 0,
    })
    expect(resolveMatureSkillVersion('lifebinder.mending-light')?.target.maximumRange).toBe(3)
    expect(resolveMatureSkillVersion('farstrider.longshot')?.target).toMatchObject({
      maximumRange: 5,
      maximumElevationDifference: 2,
    })
    expect(resolveMatureSkillVersion('cinderweaver.cinder-bolt')?.target).toMatchObject({
      maximumRange: 4,
      maximumElevationDifference: 1,
    })
  })

  it('keeps the prior v5 definition resolvable after publishing v5.1', () => {
    const current = resolveMatureSkillVersion('vanguard.forceful-strike')
    if (!current) throw new Error('Expected current Forceful Strike.')
    expect(current.authoring.validationTags).toContain('owner-rebalance-v5-1')

    const prior = resolveMatureSkillVersion('vanguard.forceful-strike', current.contentVersion - 1)
    if (!prior) throw new Error('Expected prior Combat v5 Forceful Strike.')
    expect(prior.authoring.validationTags).toContain('owner-rebalance-v5')
    expect(prior.authoring.validationTags).not.toContain('owner-rebalance-v5-1')
  })
})
