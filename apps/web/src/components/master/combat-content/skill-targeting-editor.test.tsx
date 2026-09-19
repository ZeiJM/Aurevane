import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SkillTargetingEditor } from './skill-targeting-editor'

function target(overrides: Partial<CombatTargetSpec> = {}): CombatTargetSpec {
  return {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'circle', radius: 2 },
    minimumRange: 1,
    maximumRange: 4,
    requiresLineOfSight: true,
    maximumElevationDifference: 1,
    friendlyFire: 'enemies-only',
    ...overrides,
  }
}

describe('Master Panel Skill targeting editor', () => {
  it('offers only the canonical target-kind and team-policy union values', () => {
    const markup = renderToStaticMarkup(
      createElement(SkillTargetingEditor, { value: target(), onChange: vi.fn() }),
    )

    for (const [value, label] of [
      ['self', 'Self'],
      ['unit', 'Unit'],
      ['ground-tile', 'Ground'],
      ['empty-tile', 'Empty Tile'],
    ]) {
      expect(markup).toContain(`<option value="${value}"`)
      expect(markup).toContain(`>${label}</option>`)
    }
    for (const [value, label] of [
      ['self', 'Self'],
      ['ally', 'Ally'],
      ['enemy', 'Enemy'],
      ['any', 'Anyone'],
    ]) {
      expect(markup).toContain(`<option value="${value}"`)
      expect(markup).toContain(`>${label}</option>`)
    }
  })

  it('shows Circle radius only for Circle and Line length only for Line', () => {
    const circle = renderToStaticMarkup(
      createElement(SkillTargetingEditor, { value: target(), onChange: vi.fn() }),
    )
    expect(circle).toContain('aria-label="Circle radius"')
    expect(circle).not.toContain('aria-label="Line length"')

    const line = renderToStaticMarkup(
      createElement(SkillTargetingEditor, {
        value: target({ shape: { kind: 'line', length: 5 } }),
        onChange: vi.fn(),
      }),
    )
    expect(line).toContain('aria-label="Line length"')
    expect(line).not.toContain('aria-label="Circle radius"')
  })

  it('surfaces impossible authored range ordering before server validation', () => {
    const markup = renderToStaticMarkup(
      createElement(SkillTargetingEditor, {
        value: target({ minimumRange: 5, maximumRange: 3 }),
        onChange: vi.fn(),
      }),
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Minimum range cannot exceed maximum range.')
    expect(markup).toContain('aria-invalid="true"')
  })
})
