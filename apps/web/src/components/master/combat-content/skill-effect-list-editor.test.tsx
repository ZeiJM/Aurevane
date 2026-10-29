import { AUTHORABLE_EFFECT_TAGS } from '@aurevane/game-core/combat/combat-effect-authoring'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  SkillEffectListEditor,
  createDefaultCombatEffect,
  appendCombatEffect,
  moveCombatEffect,
  moveCombatEffectDescription,
  removeCombatEffect,
} from './skill-effect-list-editor'

const effects: readonly CombatEffectDefinition[] = [
  { type: 'damage', recipient: 'primary-unit', amount: 8 },
  { type: 'apply-status', recipient: 'primary-unit', statusId: 'covert', stacks: 1 },
  { type: 'sensory', recipient: 'primary-unit', revealedDurationOwnerTurnStarts: 3 },
]

describe('Master Panel Skill effect list editor', () => {
  it('authors Push and Pull as separate choices with exact direction', () => {
    expect(createDefaultCombatEffect('push')).toEqual({
      type: 'displace',
      recipient: 'primary-unit',
      direction: 'push',
      distance: 1,
    })
    expect(createDefaultCombatEffect('pull')).toEqual({
      type: 'displace',
      recipient: 'primary-unit',
      direction: 'pull',
      distance: 1,
    })
    const markup = renderToStaticMarkup(
      createElement(SkillEffectListEditor, { value: [], onChange: vi.fn() }),
    )
    expect(markup).toContain('<option value="push">Push</option>')
    expect(markup).toContain('<option value="pull">Pull</option>')
    expect(markup).not.toContain('<option value="displace"')
  })
  it('creates a complete canonical Cleanse by default', () => {
    expect(createDefaultCombatEffect('remove-status')).toEqual({
      type: 'remove-status',
      recipient: 'primary-unit',
      statusIds: ['burn', 'bleed', 'poison', 'slow', 'root', 'exposed', 'mark', 'challenged'],
    })
  })
  it('renders authored effects in exact visible order', () => {
    const markup = renderToStaticMarkup(
      createElement(SkillEffectListEditor, { value: effects, onChange: vi.fn() }),
    )

    expect(markup).toContain('data-effect-sequence="damage|apply-status|sensory"')
    expect(markup.indexOf('data-effect-type="damage"')).toBeLessThan(
      markup.indexOf('data-effect-type="apply-status"'),
    )
    expect(markup.indexOf('data-effect-type="apply-status"')).toBeLessThan(
      markup.indexOf('data-effect-type="sensory"'),
    )
  })

  it('adds, removes, and reorders without mutating the original array', () => {
    const appended = appendCombatEffect(effects, 'barrier-change')
    expect(appended.map((effect) => effect.type)).toEqual([
      'damage',
      'apply-status',
      'sensory',
      'barrier-change',
    ])

    const moved = moveCombatEffect(effects, 2, 'up')
    expect(moved.map((effect) => effect.type)).toEqual(['damage', 'sensory', 'apply-status'])
    expect(moveCombatEffectDescription(['Damage copy', null, 'Sensory copy'], 2, 'up')).toEqual([
      'Damage copy',
      'Sensory copy',
      null,
    ])

    const removed = removeCombatEffect(effects, 1)
    expect(removed.map((effect) => effect.type)).toEqual(['damage', 'sensory'])
    expect(effects.map((effect) => effect.type)).toEqual(['damage', 'apply-status', 'sensory'])
  })

  it('offers every current effect-union member and no raw JSON/script editor', () => {
    const markup = renderToStaticMarkup(
      createElement(SkillEffectListEditor, { value: effects, onChange: vi.fn() }),
    )
    for (const tag of AUTHORABLE_EFFECT_TAGS) expect(markup).toContain(`<option value="${tag.id}"`)
    expect(markup).not.toContain('Player-facing effect description')
    expect(markup).not.toContain('aria-label="Effect 1 player-facing description"')
    expect(markup).toContain('data-effect-collapsible="true"')
    expect(markup).not.toContain('<textarea')
    expect(markup).not.toContain('Raw JSON')
    expect(markup).not.toContain('Script')
  })
})

it('provides reusable Instant one-turn Blindside authoring', () => {
  expect(createDefaultCombatEffect('blindside')).toEqual({
    type: 'apply-status',
    recipient: 'actor',
    statusId: 'blindside',
    stacks: 1,
    durationTurns: 1,
  })
})

it('authors the visible limited Cleanse Chilled using the existing removal payload', () => {
  expect(createDefaultCombatEffect('cleanse-chilled')).toEqual({
    type: 'remove-status',
    recipient: 'actor',
    statusIds: ['frozen'],
  })
})

it('offers Conditional Cleanse using only the native specified removal payload', () => {
  const effect = createDefaultCombatEffect('conditional-cleanse')
  expect(effect).toEqual({
    type: 'remove-status',
    recipient: 'primary-unit',
    statusIds: ['burn'],
    removalMode: 'specified',
  })
  const html = renderToStaticMarkup(
    createElement(SkillEffectListEditor, {
      value: [effect],
      onChange: vi.fn(),
    }),
  )
  expect(html).toContain('<option value="conditional-cleanse">Conditional Cleanse</option>')
  expect(html).toContain('<strong>Conditional Cleanse</strong>')
})
