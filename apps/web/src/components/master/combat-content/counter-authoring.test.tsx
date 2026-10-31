import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { SkillEffectEditor } from './skill-effect-editor'
import { AbilityNumber } from './ability-editor-fields'
import { previewEffect } from '../../character/skill-effect-preview'
import { skillEffectDescription } from '../../character/skill-detail-presentation'
import { canonicalEffectExplanation } from '../../character/canonical-effect-explanation'

const effect = {
  type: 'apply-status' as const,
  recipient: 'actor' as const,
  statusId: 'counter',
  stacks: 1,
  durationTurns: 3,
  counter: { kind: 'mystic' as const, basisPoints: 17500 },
}
it('offers only Counter type, potency and duration alongside effect target', () => {
  const html = renderToStaticMarkup(
    createElement(SkillEffectEditor, { value: effect, onChange: vi.fn() }),
  )
  expect(html).toContain('aria-label="Counter type"')
  expect(html).toContain('aria-label="Counter potency (%)"')
  expect(html).toContain('aria-label="Effect duration (turns)"')
  expect(html).not.toContain('aria-label="Status"')
  expect(html).not.toContain('aria-label="Status stacks"')
  expect(html).not.toContain('aria-label="Status potency (percent)"')
  expect(html).toContain('Mystical Counter</option>')
})
it('saves percentages above 100 without resetting type or duration', () => {
  const onChange = vi.fn()
  const tree = SkillEffectEditor({ value: effect, onChange })
  function find(node: ReactNode): { onChange(value: number): void; max?: number } | undefined {
    if (Array.isArray(node)) return node.map(find).find(Boolean)
    if (!isValidElement<{ children?: ReactNode; label?: string }>(node)) return
    if (node.type === AbilityNumber && node.props.label === 'Counter potency (%)')
      return node.props as never
    return find(node.props.children)
  }
  const potency = find(tree)!
  expect(potency.max).toBeUndefined()
  potency.onChange(250.25)
  expect(onChange).toHaveBeenCalledWith({
    ...effect,
    counter: { kind: 'mystic', basisPoints: 25025 },
  })
})
it('describes the actual saved Counter type, percentage and duration', () => {
  expect(previewEffect(effect)).toMatchObject({ magnitude: 'Mystical 175%' })
  expect(skillEffectDescription(effect)).toContain('175% of Mystical damage')
  expect(skillEffectDescription(effect)).toContain('3 turns')
  expect(canonicalEffectExplanation(effect, {} as never)?.description).toContain(
    '175% of Mystical damage',
  )
})
