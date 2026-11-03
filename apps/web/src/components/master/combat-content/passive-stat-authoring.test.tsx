import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { AbilityEffectEditor } from './ability-effect-editor'
import { createAuthorableEffectPayload } from '@aurevane/game-core/combat/combat-effect-authoring'
import { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'

it('authors a real ongoing flat stat bonus and reports its exact units', () => {
  const payload = createAuthorableEffectPayload('stat-bonus', {
    combination: { activation: 'ongoing', mode: 'modifier' },
  })
  expect(payload).toEqual({ type: 'stat-bonus', recipient: 'actor', stat: 'movement', amount: 1 })
  const effect = {
    id: 'bonus',
    payload: {
      type: 'stat-bonus' as const,
      recipient: 'actor' as const,
      stat: 'evasion' as const,
      amount: 100,
    },
  }
  const html = renderToStaticMarkup(
    createElement(AbilityEffectEditor, { value: effect, onChange: () => {} }),
  )
  expect(html).toContain('Flat stat bonus')
  expect(html).toContain('Evasion (basis points; 100 = 1%)')
  const behavior: AbilityBehavior = {
    id: 'passive',
    activation: 'ongoing',
    mode: 'modifier',
    classification: 'utility',
    costs: [],
    cooldown: null,
    targeting: null,
    requirements: null,
    effects: [effect],
  }
  expect(JSON.stringify(abilityBehaviorInformation(behavior))).toContain('100 = 1%')
})
it('reports an explicit finite limit and packet element without adding Skill usage controls', () => {
  const behavior: AbilityBehavior = {
    id: 'use',
    activation: 'manual',
    mode: 'action',
    classification: 'utility',
    costs: [],
    cooldown: null,
    targeting: null,
    requirements: null,
    maximumUsesPerBattle: 3,
    effects: [],
  }
  expect(abilityBehaviorInformation(behavior).limits).toContain('3 uses per battle')
  const html = renderToStaticMarkup(
    createElement(AbilityEffectEditor, {
      value: {
        id: 'bonus',
        payload: {
          type: 'damage-bonus',
          recipient: 'actor',
          multiplierBasisPoints: 15000,
          elementFilter: 'fire',
        },
      },
      onChange: () => {},
    }),
  )
  expect(html).toContain('Direct damage element')
})
