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
  })

  it('offers Automatic Hit and Accuracy Roll and exposes the signed modifier only for rolls', () => {
    const roll = renderToStaticMarkup(
      createElement(SkillEconomyEditor, { value: draft(), onChange: vi.fn() }),
    )
    expect(roll).toContain('<option value="automatic">Automatic Hit</option>')
    expect(roll).toContain('<option value="per-target" selected="">Accuracy Roll</option>')
    expect(roll).toContain('aria-label="Accuracy modifier (basis points)"')
    expect(roll).toContain('min="-3000"')
    expect(roll).toContain('max="3000"')
    expect(roll).toContain('value="-750"')

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
