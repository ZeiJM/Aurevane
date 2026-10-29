import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import { createElement, isValidElement, type ReactNode } from 'react'
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
  it('keeps Range & Area focused on geometry and moves target choices to Effects', () => {
    const onChange = vi.fn()
    const markup = renderToStaticMarkup(
      createElement(SkillTargetingEditor, { value: target(), onChange }),
    )
    expect(markup).toContain('Range &amp; Area')
    expect(markup).toContain('Targetable Elevation')
    expect(markup).not.toContain('Target kind')
    expect(markup).not.toContain('Team policy')
    expect(markup).not.toContain('>All</option>')
    expect(markup).toContain('>On</option>')
    expect(markup).toContain('>Off</option>')
    expect(onChange).not.toHaveBeenCalled()
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

it('applies Combat v5.1 maximum range and elevation authoring bounds without changing historical defaults', () => {
  const currentMarkup = renderToStaticMarkup(
    createElement(SkillTargetingEditor, {
      value: target(),
      v51Rules: true,
      onChange: vi.fn(),
    }),
  )

  expect(currentMarkup).toMatch(/aria-label="Maximum target range"[^>]*min="1"[^>]*max="5"/u)
  expect(currentMarkup).toMatch(/aria-label="Targetable Elevation"[^>]*min="0"[^>]*max="2"/u)
  expect(currentMarkup).toContain('Elevation 0 is standard; 1 is uncommon; 2 is rare.')
  expect(currentMarkup).toContain('Skipping line of sight consumes targeting budget.')

  const historicalMarkup = renderToStaticMarkup(
    createElement(SkillTargetingEditor, { value: target(), onChange: vi.fn() }),
  )
  expect(historicalMarkup).not.toMatch(/aria-label="Maximum target range"[^>]*max="5"/u)
  expect(historicalMarkup).not.toMatch(/aria-label="Targetable Elevation"[^>]*max="2"/u)
})

import { normalizeCurrentCombatTargetSpec } from '@aurevane/game-core/combat/combat-targeting-shapes'
it('preserves an existing global footprint without offering All as a new Shape', () => {
  const value = normalizeCurrentCombatTargetSpec(target({ shape: { kind: 'all' } }))
  const markup = renderToStaticMarkup(
    createElement(SkillTargetingEditor, { value, onChange: vi.fn() }),
  )
  expect(markup).toContain(
    '<option value="all" disabled="" selected="">Existing global footprint</option>',
  )
  for (const name of [
    'Maximum target range',
    'Minimum target range',
    'Circle radius',
    'Line length',
    'Requires line of sight',
  ])
    expect(markup).not.toContain(`aria-label="${name}"`)
  for (const name of ['Target kind', 'Team policy'])
    expect(markup).not.toContain(`aria-label="${name}"`)
  for (const name of ['Friendly Fire', 'Targetable Elevation'])
    expect(markup).toContain(`aria-label="${name}"`)
  expect(value).toMatchObject({
    geometryVersion: 2,
    minimumRange: 0,
    maximumRange: 0,
    requiresLineOfSight: false,
  })
})
it.each([
  { kind: 'circle', radius: 2 },
  { kind: 'line', length: 4 },
] as const)('offers one positive bounded X for %j', (shape) => {
  const value = normalizeCurrentCombatTargetSpec(target({ shape }))
  const markup = renderToStaticMarkup(
    createElement(SkillTargetingEditor, { value, onChange: vi.fn() }),
  )
  expect(markup).not.toContain('aria-label="Maximum target range"')
  expect(markup).not.toContain('aria-label="Minimum target range"')
  expect(markup).toMatch(/aria-label="(?:Circle radius|Line length)"[^>]*min="1"[^>]*max="5"/u)
  expect(value).toMatchObject({
    geometryVersion: 2,
    minimumRange: 0,
    maximumRange: shape.kind === 'circle' ? shape.radius : shape.length,
  })
})

it('offers an explicit conversion from retained multiple selections without changing it on open', () => {
  const value = target({ maximumSelections: 3 })
  const onChange = vi.fn()
  const tree = SkillTargetingEditor({ value, onChange })
  const html = renderToStaticMarkup(tree)
  expect(html).toContain('Use one shared aim')
  expect(onChange).not.toHaveBeenCalled()
  function find(node: ReactNode): { onClick: () => void } | undefined {
    if (Array.isArray(node)) return node.map(find).find(Boolean)
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return
    if (node.type === 'button') return node.props as { onClick: () => void }
    return find(node.props.children)
  }
  find(tree)!.onClick()
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      maximumSelections: 1,
      shape: value.shape,
      maximumRange: value.maximumRange,
    }),
  )
  expect(value.maximumSelections).toBe(3)
})
