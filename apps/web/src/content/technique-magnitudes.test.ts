import { describe, expect, it } from 'vitest'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
} from '@aurevane/game-core/combat/mature-skills'
import { techniqueMagnitudeBands } from './technique-magnitudes'

describe('catalog magnitude comparisons', () => {
  it('counts current versions only, separates hits from commands, and never invents Barrier values', () => {
    const skills = latestEnabledMatureSkills()
    expect(skills).toHaveLength(136)
    const bands = techniqueMagnitudeBands(skills)
    expect(bands.find((band) => band.family === 'Direct damage / hit')?.count).toBe(77)
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
