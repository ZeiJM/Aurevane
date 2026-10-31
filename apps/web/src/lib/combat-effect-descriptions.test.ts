import { expect, it } from 'vitest'
import { AUTHORABLE_EFFECT_TAGS } from '@aurevane/game-core/combat/combat-effect-authoring'
import { effectTagDescription } from './combat-effect-descriptions'

it.each(AUTHORABLE_EFFECT_TAGS)('provides concise generic help for current $label', (tag) => {
  expect(effectTagDescription(tag.id)).toBeTruthy()
})

it('does not claim all Burn ticks weaken or that hostile Fire automatically removes Chilled', () => {
  expect(effectTagDescription('burn')).not.toContain('Each tick weakens')
  expect(effectTagDescription('status:frozen')).toContain('Cleanse Chilled')
  expect(effectTagDescription('status:frozen')).not.toContain('Fire removes')
})
