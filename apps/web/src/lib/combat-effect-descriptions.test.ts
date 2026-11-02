import { expect, it } from 'vitest'
import { AUTHORABLE_EFFECT_TAGS } from '@aurevane/game-core/combat/combat-effect-authoring'
import { effectTagDescription, endureDescription } from './combat-effect-descriptions'

it('keeps captured Endure popup help short with its actual radius and release percentage', () => {
  const text = endureDescription({
    releaseBasisPoints: 80000,
    radiusTiles: 1,
    targetTeams: 'enemies',
  })
  expect(text).toContain('Cannot attack')
  expect(text).toContain('800%')
  expect(text).toContain('enemy within 1 tile')
  expect(text).toContain('Cannot be dispelled')
  expect(text.length).toBeLessThan(230)
  expect(effectTagDescription('endure')!.length).toBeLessThan(210)
})

it.each(AUTHORABLE_EFFECT_TAGS)('provides concise generic help for current $label', (tag) => {
  expect(effectTagDescription(tag.id)).toBeTruthy()
})

it('does not claim all Burn ticks weaken or that hostile Fire automatically removes Chilled', () => {
  expect(effectTagDescription('burn')).not.toContain('Each tick weakens')
  expect(effectTagDescription('status:frozen')).toBe(
    'Prevents the target from choosing its final facing.',
  )
  expect(effectTagDescription('status:frozen')).not.toContain('Fire removes')
})

it('describes Ruin as spending consumable debuffs for one landed hit', () => {
  const description = effectTagDescription('ruin')!
  expect(description).toContain('first landed hit')
  expect(description).toContain('consumes')
  expect(description).toContain('Later hits')
  expect(description).toContain('applied afterward')
})
