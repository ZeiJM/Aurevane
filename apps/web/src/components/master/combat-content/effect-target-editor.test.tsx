import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { EffectTargetEditor } from './effect-target-editor'
import { SkillEffectEditor } from './skill-effect-editor'

it('offers seven readable targets, with engine restrictions and no edit merely from opening', () => {
  const onChange = vi.fn()
  const html = renderToStaticMarkup(
    createElement(EffectTargetEditor, {
      value: { type: 'damage', recipient: 'primary-unit' },
      onChange,
    }),
  )
  expect(html).toContain('aria-label="Target"')
  for (const label of ['Self', 'Ally', 'Enemy', 'Anyone', 'All', 'Ground', 'Empty Tile'])
    expect(html).toContain(label)
  expect(html).toMatch(/value="self"[^>]*disabled/)
  expect(html).toContain('Direct damage cannot target Self')
  expect(html).toContain('aria-label="About Target"')
  expect(html).not.toContain('<summary>Target limits</summary>')
  expect(onChange).not.toHaveBeenCalled()
})
it('replaces opcode recipient selectors with the common per-effect Target', () => {
  const html = renderToStaticMarkup(
    createElement(SkillEffectEditor, {
      value: { type: 'damage', recipient: 'primary-unit', amount: 10 },
      onChange: vi.fn(),
    }),
  )
  expect(html).toContain('aria-label="Target"')
  expect(html).not.toContain('Damage recipient')
})
it('selects a target through the actual control without changing magnitude', () => {
  const onChange = vi.fn()
  function find(
    node: ReactNode,
  ): { onChange: (event: { currentTarget: { value: string } }) => void } | undefined {
    if (Array.isArray(node)) return node.map(find).find(Boolean)
    if (!isValidElement<{ children?: ReactNode; onChange?: unknown }>(node)) return
    if (node.type === 'select') return node.props as never
    return find(node.props.children)
  }
  const field = find(
    EffectTargetEditor({ value: { type: 'healing', recipient: 'actor' }, onChange }),
  )!
  field.onChange({ currentTarget: { value: 'ally' } })
  expect(onChange).toHaveBeenCalledWith('ally')
})

it('allows Ground alongside an explicit unit packet and on inherited modifier footprints', () => {
  const value = { type: 'damage', recipient: 'affected-units', target: 'enemy' } as const
  const ground = { type: 'damage', recipient: 'affected-units', target: 'ground' } as const
  const aim = {
    kind: 'unit',
    teamPolicy: 'enemy',
    friendlyFire: 'enemies-only',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 3,
    requiresLineOfSight: false,
    maximumElevationDifference: 0,
  } as const
  const mixed = renderToStaticMarkup(
    <EffectTargetEditor value={value} aim={aim} siblings={[value, ground]} onChange={() => {}} />,
  )
  expect(mixed).toMatch(/<option value="ground">Ground<\/option>/)
  const modifier = renderToStaticMarkup(<EffectTargetEditor value={value} onChange={() => {}} />)
  expect(modifier).toMatch(/<option value="ground">Ground<\/option>/)
})
