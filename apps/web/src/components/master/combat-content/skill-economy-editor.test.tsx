import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SkillEconomyEditor, type SkillEconomyDraft } from './skill-economy-editor'

function draft(overrides: Partial<SkillEconomyDraft> = {}): SkillEconomyDraft {
  return {
    apCost: 40,
    mpCost: 5,
    accuracyMode: 'per-target',
    accuracyModifierBasisPoints: -750,
    cooldown: { key: 'vanguard.forceful-strike', ownerTurns: 2 },
    ...overrides,
  }
}

describe('Master Panel Skill economy editor', () => {
  it('edits canonical AP and MP bounds', () => {
    const markup = renderToStaticMarkup(
      createElement(SkillEconomyEditor, { value: draft(), onChange: vi.fn() }),
    )

    expect(markup).toContain('aria-label="Action Economy (AP)"')
    expect(markup).toContain('min="1"')
    expect(markup).toContain('max="100"')
    expect(markup).toContain('value="40"')
    expect(markup).toContain('aria-label="MP cost"')
    expect(markup).toContain('min="0"')
    expect(markup).toContain('max="20"')
    expect(markup).toContain('value="5"')
    expect(markup).toContain('aria-label="Cooldown (turns)"')
    expect(markup).toContain('max="3"')
  })

  it('offers Always Hit and Accuracy Roll without per-Skill modifiers', () => {
    const roll = renderToStaticMarkup(
      createElement(SkillEconomyEditor, { value: draft(), onChange: vi.fn() }),
    )
    expect(roll).toContain('<option value="automatic">Always Hit</option>')
    expect(roll).toContain('<option value="per-target" selected="">Accuracy Roll</option>')
    expect(roll).not.toContain('aria-label="Accuracy modifier (basis points)"')

    const automatic = renderToStaticMarkup(
      createElement(SkillEconomyEditor, {
        value: draft({ accuracyMode: 'automatic', accuracyModifierBasisPoints: undefined }),
        onChange: vi.fn(),
      }),
    )
    expect(automatic).not.toContain('aria-label="Accuracy modifier (basis points)"')
  })

  it('does not expose editable gameplay tags', () => {
    const markup = renderToStaticMarkup(
      createElement(SkillEconomyEditor, { value: draft(), onChange: vi.fn() }),
    )

    expect(markup).not.toContain('name="tags"')
    expect(markup).not.toContain('Gameplay tags')
  })
})

it('uses explicit AP authoring bounds when the selected current ruleset supplies them', () => {
  const markup = renderToStaticMarkup(
    createElement(SkillEconomyEditor, {
      value: draft({ apCost: 50 }),
      apCostBounds: { minimum: 45, maximum: 60 },
      onChange: vi.fn(),
    }),
  )

  expect(markup).toMatch(/aria-label="Action Economy \(AP\)"[^>]*min="45"[^>]*max="60"/u)
})

it('names the accuracy bypass Always Hit and omits per-Skill accuracy modifiers', () => {
  const html = renderToStaticMarkup(
    createElement(SkillEconomyEditor, {
      value: {
        apCost: 50,
        mpCost: 10,
        accuracyMode: 'per-target',
        accuracyModifierBasisPoints: 100,
        cooldown: null,
      },
      onChange: () => {},
    }),
  )
  expect(html).toContain('>Always Hit</option>')
  expect(html).not.toContain('Accuracy modifier')
})

it('offers optional HP and MP with nonlethal payment help and preserves values on open', () => {
  const onChange = vi.fn()
  const html = renderToStaticMarkup(
    createElement(SkillEconomyEditor, { value: draft({ hpCost: 12 }), onChange }),
  )
  expect(html).toContain('aria-label="HP cost"')
  expect(html).toContain('value="12"')
  expect(html).not.toContain('Remove HP cost')
  expect(html).not.toContain('Remove MP cost')
  expect(html).toContain('at least 1 HP')
  expect(onChange).not.toHaveBeenCalled()
  const empty = renderToStaticMarkup(
    createElement(SkillEconomyEditor, { value: draft({ mpCost: undefined }), onChange }),
  )
  expect(empty).toContain('aria-label="HP cost"')
  expect(empty).toContain('aria-label="MP cost"')
  expect(empty).toContain('Set MP or HP to 0 for no cost')
})
