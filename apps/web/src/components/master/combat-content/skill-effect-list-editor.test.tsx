import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  SkillEffectListEditor,
  appendCombatEffect,
  moveCombatEffect,
  removeCombatEffect,
} from './skill-effect-list-editor'

const effects: readonly CombatEffectDefinition[] = [
  { type: 'damage', recipient: 'primary-unit', amount: 8 },
  { type: 'apply-status', recipient: 'primary-unit', statusId: 'covert', stacks: 1 },
  { type: 'sensory', recipient: 'primary-unit', revealedDurationOwnerTurnStarts: 3 },
]

describe('Master Panel Skill effect list editor', () => {
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

  it('creates the typed temporary Skill Copy effect without scriptable fields', () => {
    const appended = appendCombatEffect(effects, 'copy')
    expect(appended.at(-1)).toEqual({ type: 'copy', recipient: 'primary-unit' })
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

    const removed = removeCombatEffect(effects, 1)
    expect(removed.map((effect) => effect.type)).toEqual(['damage', 'sensory'])
    expect(effects.map((effect) => effect.type)).toEqual(['damage', 'apply-status', 'sensory'])
  })

  it('offers every current effect-union member and no raw JSON/script editor', () => {
    const markup = renderToStaticMarkup(
      createElement(SkillEffectListEditor, { value: effects, onChange: vi.fn() }),
    )
    const effectTypes: readonly CombatEffectDefinition['type'][] = [
      'damage',
      'healing',
      'resource-change',
      'apply-status',
      'remove-status',
      'return-to-turn-start',
      'create-terrain',
      'displace',
      'poison',
      'bleed',
      'burn',
      'barrier-change',
      'copy-statuses',
      'copy',
      'sensory',
    ]

    for (const type of effectTypes) expect(markup).toContain(`<option value="${type}"`)
    expect(markup).not.toContain('<textarea')
    expect(markup).not.toContain('Raw JSON')
    expect(markup).not.toContain('Script')
  })
})
