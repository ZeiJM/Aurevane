import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { DamageUpTypeControls } from './damage-up-type-controls'
import { SkillEffectEditor } from './skill-effect-editor'
import { AbilityEffectEditor } from './ability-effect-editor'
import { compactSkillEffectSummaryParts } from '../../character/skill-detail-presentation'
import { previewEffect } from '../../character/skill-effect-preview'
import { BattleCombatantEffects } from '../../battle/battle-combatant-effects'
function control(
  node: ReactNode,
  label: string,
): { onChange(event: { currentTarget: { checked: boolean } }): void } | undefined {
  if (Array.isArray(node)) return node.map((child) => control(child, label)).find(Boolean)
  if (!isValidElement<{ children?: ReactNode; 'aria-label'?: string }>(node)) return
  if (node.props['aria-label'] === label) return node.props as never
  return control(node.props.children, label)
}
const effect = {
  type: 'apply-status' as const,
  recipient: 'actor' as const,
  statusId: 'inspired',
  stacks: 1,
  durationTurns: 3,
  potencyBasisPoints: 2000,
  damageTypes: ['fire', 'ice'] as const,
}
it('chooses combinations with one percentage, and restores exclusive All Damage', () => {
  const onChange = vi.fn()
  const tree = DamageUpTypeControls({ value: effect.damageTypes, onChange })
  for (const label of ['Pierce', 'Fire', 'Water', 'Ice', 'Storm', 'All Damage'])
    expect(control(tree, `Damage Up ${label}`)).toBeDefined()
  control(tree, 'Damage Up Pierce')!.onChange({ currentTarget: { checked: true } })
  expect(onChange).toHaveBeenLastCalledWith(['pierce', 'fire', 'ice'])
  control(tree, 'Damage Up All Damage')!.onChange({ currentTarget: { checked: true } })
  expect(onChange).toHaveBeenLastCalledWith(undefined)
  const all = DamageUpTypeControls({ onChange })
  control(all, 'Damage Up Fire')!.onChange({ currentTarget: { checked: true } })
  expect(onChange).toHaveBeenLastCalledWith(['fire'])
})
it('wires the same scope controls into timed and canonical Damage Up editors', () => {
  const timed = renderToStaticMarkup(
    createElement(SkillEffectEditor, { value: effect, onChange: () => {} }),
  )
  const canonical = renderToStaticMarkup(
    createElement(AbilityEffectEditor, {
      value: {
        id: 'bonus',
        payload: {
          type: 'damage-bonus',
          recipient: 'actor',
          multiplierBasisPoints: 12000,
          elementFilter: 'fire',
        },
      },
      onChange: () => {},
    }),
  )
  for (const html of [timed, canonical]) expect(html).toContain('aria-label="Damage Up Pierce"')
  expect(timed).toContain('aria-label="Effect duration (turns)"')
  expect(canonical).toContain('aria-label="Damage Up Fire"')
})
it('reports actual scoped strength in compact and captured battle readers', () => {
  expect(previewEffect(effect)).toMatchObject({ magnitude: '+20% Fire / Ice' })
  expect(compactSkillEffectSummaryParts(effect).magnitude).toBe('20% Fire / Ice')
  expect(previewEffect(effect).explanation).toContain('Fire / Ice')
  const html = renderToStaticMarkup(
    createElement(BattleCombatantEffects, {
      name: 'Actor',
      compact: true,
      statuses: [
        { ...effect, statusVersion: 1, remainingOwnerTurnStarts: 3, sourceCombatantId: 'actor' },
      ],
    }),
  )
  expect(html).toContain('Fire / Ice')
})
it('keeps different scopes visible for stacked captured applications', () => {
  const html = renderToStaticMarkup(
    createElement(BattleCombatantEffects, {
      name: 'Actor',
      compact: true,
      statuses: [
        {
          ...effect,
          statusVersion: 1,
          stacks: 2,
          remainingOwnerTurnStarts: 3,
          sourceCombatantId: 'actor',
          effectStackingPolicyVersion: 1,
          applicationModifiers: [
            {
              stacks: 1,
              sourceCombatantId: 'actor',
              potencyBasisPoints: 2000,
              damageTypes: ['fire'],
            },
            {
              stacks: 1,
              sourceCombatantId: 'actor',
              potencyBasisPoints: 5000,
              damageTypes: ['pierce'],
            },
          ],
        },
      ],
    }),
  )
  expect(html).toContain('20% more Fire damage')
  expect(html).toContain('50% more Pierce damage')
})
it('does not lend the newest scope to an older unrestricted application in the active reader', () => {
  const html = renderToStaticMarkup(
    createElement(BattleCombatantEffects, {
      name: 'Actor',
      compact: true,
      statuses: [
        {
          ...effect,
          damageTypes: ['fire'],
          statusVersion: 1,
          stacks: 2,
          remainingOwnerTurnStarts: 3,
          sourceCombatantId: 'actor',
          effectStackingPolicyVersion: 1,
          applicationModifiers: [
            { stacks: 1, sourceCombatantId: 'actor', potencyBasisPoints: 2000 },
            {
              stacks: 1,
              sourceCombatantId: 'actor',
              potencyBasisPoints: 5000,
              damageTypes: ['fire'],
            },
          ],
        },
      ],
    }),
  )
  expect(html).toContain('20% more damage per application')
  expect(html).toContain('50% more Fire damage')
})
