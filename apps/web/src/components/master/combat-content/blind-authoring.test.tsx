import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { SkillEffectEditor } from './skill-effect-editor'
import { previewEffect } from '../../character/skill-effect-preview'
import { BattleCombatantEffects } from '../../battle/battle-combatant-effects'

const blind = {
  type: 'apply-status' as const,
  recipient: 'primary-unit' as const,
  statusId: 'blind',
  stacks: 1,
  durationTurns: 99,
}

it('authors Blind percentage-point potency through999% with99turn duration and no status selector', () => {
  const onChange = vi.fn()
  const tree = SkillEffectEditor({ value: blind, onChange })
  function find(node: ReactNode): { onChange(value: number): void } | undefined {
    if (Array.isArray(node)) return node.map(find).find(Boolean)
    if (!isValidElement<{ children?: ReactNode; label?: string }>(node)) return
    if (node.props.label === 'Accuracy reduction (%)') return node.props as never
    return find(node.props.children)
  }
  const control = find(tree)
  expect(control).toBeDefined()
  control!.onChange(999)
  expect(onChange).toHaveBeenCalledWith({ ...blind, potencyBasisPoints: 99900 })
  const html = renderToStaticMarkup(tree)
  expect(html).toMatch(/aria-label="Accuracy reduction \(%\)"[^>]*min="1"[^>]*max="999"/u)
  expect(html).toMatch(/aria-label="Effect duration \(turns\)"[^>]*max="99"/u)
  expect(html).not.toContain('aria-label="Status"')
  expect(html).not.toContain('aria-label="Status stacks"')
})

it('reads default Blind potency and retains its distinct crossed-eye rail identity', () => {
  expect(previewEffect(blind)).toMatchObject({ label: 'Blind', magnitude: '−15 pp Accuracy' })
  const html = renderToStaticMarkup(
    createElement(BattleCombatantEffects, {
      name: 'Actor',
      compact: true,
      statuses: [
        {
          statusId: 'blind',
          statusVersion: 1,
          stacks: 1,
          remainingOwnerTurnStarts: 2,
          sourceCombatantId: 'enemy',
          potencyBasisPoints: 3000,
        },
      ],
    }),
  )
  expect(html).toContain('data-battle-effect-icon="blind"')
  expect(html).toContain('Lose 30 percentage points Accuracy')
})
