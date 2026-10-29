import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { SkillFormatUpgradeControl } from './skill-format-upgrade-control'

it('opens the full draft editor only after the real upgrade button is selected', () => {
  const source = latestEnabledMatureSkills()[0]!,
    onChange = vi.fn()
  const tree = SkillFormatUpgradeControl({ value: source, onChange })
  renderToStaticMarkup(tree)
  expect(onChange).not.toHaveBeenCalled()
  function find(node: ReactNode): (() => void) | undefined {
    if (Array.isArray(node)) return node.map(find).find(Boolean)
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return
    if (node.type === 'button') return node.props.onClick
    return find(node.props.children)
  }
  find(tree)!()
  expect(onChange).toHaveBeenCalledOnce()
  expect(onChange.mock.calls[0]![0].ability.behaviors[0].effects).toHaveLength(
    source.effects.length,
  )
})
it('makes different context rules an explicit choice', () => {
  const value = { ...latestEnabledMatureSkills()[0]!, overrides: { pvp: { apCost: 99 } } }
  const html = renderToStaticMarkup(
    createElement(SkillFormatUpgradeControl, { value, onChange: vi.fn() }),
  )
  expect(html).toContain('Use base rules')
  expect(html).toContain('Use PvP rules')
  expect(html).toContain('both PvE and PvP')
})
