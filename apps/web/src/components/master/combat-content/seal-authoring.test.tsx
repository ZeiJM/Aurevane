import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { SkillEffectEditor } from './skill-effect-editor'
import { previewEffect } from '../../character/skill-effect-preview'
import { BattleCombatantEffects } from '../../battle/battle-combatant-effects'

const seal = {
  type: 'apply-status' as const,
  recipient: 'primary-unit' as const,
  statusId: 'seal',
  stacks: 1,
  durationTurns: 2,
  sealedCategories: ['attack', 'utility'] as const,
}
function control(
  node: ReactNode,
  label: string,
): { onChange(event: { currentTarget: { checked: boolean } }): void } | undefined {
  if (Array.isArray(node)) return node.map((child) => control(child, label)).find(Boolean)
  if (!isValidElement<{ children?: ReactNode; 'aria-label'?: string }>(node)) return
  if (node.props['aria-label'] === label) return node.props as never
  return control(node.props.children, label)
}
it('provides independent Seal category checkboxes and an all-categories toggle', () => {
  const onChange = vi.fn()
  const tree = SkillEffectEditor({ value: seal, onChange })
  for (const label of ['Attack', 'Recovery', 'Utility'])
    expect(control(tree, `Seal ${label}`)).toBeDefined()
  control(tree, 'Seal Recovery')!.onChange({ currentTarget: { checked: true } })
  expect(onChange).toHaveBeenCalledWith({
    ...seal,
    sealedCategories: ['attack', 'recovery', 'utility'],
  })
  control(tree, 'Seal all categories')!.onChange({ currentTarget: { checked: false } })
  expect(onChange).toHaveBeenCalledWith({ ...seal, sealedCategories: [] })
  const html = renderToStaticMarkup(tree)
  expect(html).toContain('aria-label="Effect duration (turns)"')
  expect(html).not.toContain('aria-label="Status stacks"')
})
it('shows selected categories and source exemptions in the shared Seal reader', () => {
  expect(previewEffect(seal)).toMatchObject({ label: 'Seal', magnitude: 'Attack, Utility' })
  expect(previewEffect(seal).explanation).toContain('Attack, Utility discipline skills')
  expect(previewEffect(seal).explanation).toContain(
    'Essence, Resonance, Support, Severance and Ascension',
  )
})
it('shows a distinct Seal rail identity and the captured category restriction', () => {
  const html = renderToStaticMarkup(
    createElement(BattleCombatantEffects, {
      name: 'Actor',
      compact: true,
      statuses: [
        {
          statusId: 'seal',
          statusVersion: 1,
          stacks: 1,
          remainingOwnerTurnStarts: 2,
          sourceCombatantId: 'enemy',
          sealedCategories: ['attack', 'utility'] as const,
        },
      ],
    }),
  )
  expect(html).toContain('data-battle-effect-icon="seal"')
  expect(html).toContain('Attack, Utility discipline skills')
})

it('reports the union of stacked Seal categories rather than only the latest application', () => {
  const html = renderToStaticMarkup(
    createElement(BattleCombatantEffects, {
      name: 'Actor',
      compact: true,
      statuses: [
        {
          statusId: 'seal',
          statusVersion: 1,
          stacks: 2,
          remainingOwnerTurnStarts: 2,
          sourceCombatantId: 'enemy',
          effectStackingPolicyVersion: 1,
          sealedCategories: ['utility'],
          applicationModifiers: [
            { stacks: 1, sourceCombatantId: 'enemy', sealedCategories: ['attack'] },
            { stacks: 1, sourceCombatantId: 'enemy', sealedCategories: ['utility'] },
          ],
        },
      ],
    }),
  )
  expect(html).toContain('Attack, Utility discipline skills')
})
