import { expect, it } from 'vitest'
import { AUTHORABLE_EFFECT_TAGS } from '@aurevane/game-core/combat/combat-effect-authoring'
import { effectTagDescription } from './combat-effect-descriptions'

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
