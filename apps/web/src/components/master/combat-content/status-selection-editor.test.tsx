import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { createAuthorableEffectPayload } from '@aurevane/game-core/combat/combat-effect-authoring'
import { currentTagForAuthoring } from '../../../lib/combat-current-tag-authoring'
import { effectAuthoringTag } from '@aurevane/game-core/combat/combat-effect-authoring'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import { SkillEffectEditor } from './skill-effect-editor'

function render(value: CombatEffectDefinition) {
  return renderToStaticMarkup(createElement(SkillEffectEditor, { value, onChange: vi.fn() }))
}
it('full Cleanse shows only targeting while conditional and positive removals use polarity checkboxes', () => {
  const cleanse = render(nativeCombatTagPayload(createAuthorableEffectPayload('cleanse')!))
  expect(cleanse).not.toContain('Status removal mode')
  expect(cleanse).not.toContain('type="checkbox"')
  const conditional = render(
    nativeCombatTagPayload(createAuthorableEffectPayload('conditional-cleanse')!),
  )
  expect(conditional).toContain('type="checkbox"')
  expect(conditional).toContain('aria-label="Remove Healing Down"')
  expect(conditional).not.toContain('aria-label="Remove Damage Up"')
  const dispel = render(nativeCombatTagPayload(createAuthorableEffectPayload('dispel')!))
  expect(dispel).toContain('aria-label="Remove Damage Up"')
  expect(dispel).not.toContain('aria-label="Remove Healing Down"')
})
it('Copy Debuffs offers allowed status checkboxes including DoTs and retains internal permissions', () => {
  const effect: CombatEffectDefinition = {
    type: 'copy-statuses',
    recipient: 'primary-unit',
    mode: 'curse',
    allowNoEligibleEffects: true,
  }
  const html = render(effect)
  expect(html).toContain('All Debuffs')
  expect(html).toContain('aria-label="Copy Poison"')
  expect(html).toContain('aria-label="Copy Chilled"')
  expect(html).not.toContain('aria-label="Copy Revealed"')
  expect(html).not.toContain('aria-label="Copy Covert"')
  expect(html).not.toContain('Copy mode')
  expect(html).not.toContain('Allow empty status copy')
  expect(effect.allowNoEligibleEffects).toBe(true)
})
it('percentage Recovery hides fixed controls and preserves the saved schedule when potency changes', () => {
  const value: CombatEffectDefinition = {
    type: 'percentage-recovery',
    recipient: 'actor',
    resource: 'mp',
    percent: 15,
    ticks: 3,
    durationTurns: 2,
  }
  const html = render(value)
  expect(html).not.toContain('aria-label="Recovery resource"')
  expect(html).not.toContain('aria-label="Recovery applications"')
  const onChange = vi.fn()
  const tree = SkillEffectEditor({ value, onChange })
  function find(node: ReactNode): { onChange(event: unknown): void } | undefined {
    if (Array.isArray(node)) return node.map(find).find(Boolean)
    if (!isValidElement<{ children?: ReactNode; 'aria-label'?: string }>(node)) return
    if (node.props['aria-label'] === 'Recovery percent') return node.props as never
    return find(node.props.children)
  }
  find(tree)!.onChange({ currentTarget: { value: '20' } })
  expect(onChange).toHaveBeenCalledWith({ ...value, percent: 20 })
})
it('MP Drain presents positive maximum-MP potency without resource or ticks controls', () => {
  const html = render(nativeCombatTagPayload(createAuthorableEffectPayload('mp-drain')!))
  expect(html).toContain('aria-label="MP Drain potency (%)"')
  expect(html).not.toContain('MP delta')
  expect(html).not.toContain('MP ticks')
  expect(html).toContain('Effect duration (turns)')
})

it.each(['dispel', 'conditional-cleanse'] as const)(
  'keeps %s polarity after clearing all, JSON restore and selecting a new status',
  (id) => {
    let value = nativeCombatTagPayload(createAuthorableEffectPayload(id)!)
    function checkbox(label: string) {
      function find(node: ReactNode): { onChange(event: unknown): void } | undefined {
        if (Array.isArray(node)) return node.map(find).find(Boolean)
        if (!isValidElement<{ children?: ReactNode; 'aria-label'?: string }>(node)) return
        if (node.props['aria-label'] === label) return node.props as never
        if (typeof node.type === 'function' && node.type.name === 'StatusSelectionControls')
          return find((node.type as (props: unknown) => ReactNode)(node.props))
        return find(node.props.children)
      }
      return find(
        SkillEffectEditor({
          value,
          onChange: (next) => {
            value = next
          },
        }),
      )
    }
    const all = id === 'dispel' ? 'Remove All Buffs' : 'Remove All Debuffs'
    checkbox(all)!.onChange({ currentTarget: { checked: false } })
    value = nativeCombatTagPayload(JSON.parse(JSON.stringify(value)))
    value = currentTagForAuthoring(value)
    expect(effectAuthoringTag(value).id).toBe(id)
    const html = render(value)
    const chosen = id === 'dispel' ? 'Remove Guard' : 'Remove Burn'
    expect(html).toContain(`aria-label="${chosen}"`)
    expect(html).not.toContain(`aria-label="${id === 'dispel' ? 'Remove Burn' : 'Remove Guard'}"`)
    checkbox(chosen)!.onChange({ currentTarget: { checked: true } })
    expect(value).toMatchObject({ statusIds: [id === 'dispel' ? 'guarded' : 'burn'] })
    expect(effectAuthoringTag(value).id).toBe(id)
  },
)
