import { describe, expect, it } from 'vitest'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
} from '@aurevane/game-core/combat/mature-skills'
import { techniqueMagnitudeBands } from './technique-magnitudes'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'

it('samples canonical groups and basis-point recovery without stale legacy effects or cross-group totals', () => {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  const ability = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        id: 'first',
        effects: [
          {
            id: 'pierce',
            payload: {
              type: 'pierce',
              recipient: 'primary-unit',
              amount: 13,
              armorIgnoredBasisPoints: 2500,
            },
          },
          {
            id: 'hp',
            payload: {
              type: 'percentage-recovery',
              recipient: 'actor',
              resource: 'hp',
              percentageBasisPoints: 1200,
            },
          },
        ],
      },
      {
        ...base,
        id: 'second',
        effects: [{ id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 7 } }],
      },
    ],
  })
  const skill = { ...resolveMatureSkillVersion('vanguard.forceful-strike')!, ability }
  const before = JSON.stringify(skill)
  const bands = techniqueMagnitudeBands([skill])
  expect(bands.find((row) => row.family === 'Direct damage / hit')).toMatchObject({
    count: 2,
    minimum: 7,
    maximum: 13,
  })
  expect(bands.find((row) => row.family === 'Direct damage / command')).toMatchObject({
    count: 2,
    minimum: 7,
    maximum: 13,
  })
  expect(bands.find((row) => row.family === 'HP recovery / application')).toMatchObject({
    count: 1,
    minimum: 12,
    maximum: 12,
  })
  expect(JSON.stringify(skill)).toBe(before)
})

describe('catalog magnitude comparisons', () => {
  it('counts current versions only, separates hits from commands, and never invents Barrier values', () => {
    const skills = latestEnabledMatureSkills()
    expect(skills).toHaveLength(136)
    const bands = techniqueMagnitudeBands(skills)
    expect(bands.find((band) => band.family === 'Direct damage / hit')?.count).toBe(78)
    expect(bands.find((band) => band.family === 'DOT attack damage (%)')).toMatchObject({
      unit: '% attack HP damage',
      count: 15,
      maximum: 25,
    })
    expect(bands.find((band) => band.family === 'Barrier / effect')).toMatchObject({
      count: 0,
      minimum: null,
      maximum: null,
    })
  })
  it('uses nearest-rank quartiles with ties and keeps per-application and total healing separate', () => {
    const fixture = resolveMatureSkillVersion('runeblade.rune-mending')!
    const skills = [2, 4, 6, 8].map((amount) => ({
      ...fixture,
      effects: [{ type: 'healing' as const, recipient: 'actor' as const, amount, ticks: 3 }],
    }))
    const bands = techniqueMagnitudeBands(skills)
    expect(bands.find((band) => band.family === 'Healing / application')).toMatchObject({
      minimum: 2,
      lowerQuartile: 2,
      upperQuartile: 6,
      maximum: 8,
    })
    expect(
      bands.find((band) => band.family === 'Multi-application healing / effect'),
    ).toMatchObject({ minimum: 6, lowerQuartile: 6, upperQuartile: 18, maximum: 24 })
  })
})

it('includes current percentage recovery using maximum-resource units and ordinary per-packet scaling', () => {
  const skills = latestEnabledMatureSkills()
  const bands = techniqueMagnitudeBands(skills)
  for (const resource of ['hp', 'mp'] as const) {
    const effects = skills
      .flatMap((s) => s.effects)
      .filter((e) => e.type === 'percentage-recovery' && e.resource === resource)
    expect(effects.length).toBeGreaterThan(0)
    expect(
      bands.find((b) => b.family === `${resource.toUpperCase()} recovery / application`),
    ).toMatchObject({ count: effects.length, unit: `% maximum ${resource.toUpperCase()}` })
  }
  expect(bands.find((b) => b.family === 'Power coefficient / hit')).toMatchObject({
    minimum: 25,
    maximum: 25,
  })
})
