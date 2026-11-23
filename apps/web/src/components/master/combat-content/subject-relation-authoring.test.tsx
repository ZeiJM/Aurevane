import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { RequirementNode } from '@aurevane/game-core/combat/combat-definition'
import { validateAbilityRequirements } from '@aurevane/game-core/combat/combat-requirements'
import { abilityRequirementDescription } from '@/components/character/ability-detail-presentation'
import { AbilityRequirementEditor } from './ability-requirement-editor'
import { AbilitySelect } from './ability-editor-fields'

const relation = {
  kind: 'subject-relation',
  subject: 'triggering',
  otherSubject: 'owner',
  relation: 'same-unit',
} as RequirementNode

it('shared reports describe both causal subjects and distinguish ally from Self', () => {
  expect(abilityRequirementDescription(relation)).toBe('Same Unit [Trigger / Self]')
  expect(
    abilityRequirementDescription({
      kind: 'subject-relation',
      subject: 'affected',
      otherSubject: 'owner',
      relation: 'ally',
    }),
  ).toBe('Ally, excluding Self [Area / Self]')
  expect(
    abilityRequirementDescription({
      kind: 'subject-relation',
      subject: 'selected',
      otherSubject: 'triggering',
      relation: 'enemy',
    }),
  ).toBe('Enemy [Target / Trigger]')
})

it('Master creates and edits native relation nodes without executable custom text', () => {
  const onChange = vi.fn()
  const initial = AbilityRequirementEditor({ value: null, onChange })
  const kind = initial.props.children.find(
    (child: { type?: unknown } | null) => child?.type === AbilitySelect,
  )
  kind.props.onChange('subject-relation')
  const created = onChange.mock.calls[0]![0]
  expect(created).toEqual(relation)
  const tree = AbilityRequirementEditor({ value: created, onChange })
  const html = renderToStaticMarkup(tree)
  expect(html).toContain('aria-label="Other requirement subject"')
  expect(html).toContain('aria-label="Subject relation"')
  const controls = tree.props.children
    .flatMap((child: { type?: unknown; props?: { children?: unknown[] } } | null) =>
      child?.type === 'div' ? (child.props?.children ?? []) : [child],
    )
    .filter((child: { type?: unknown } | null) => child?.type === AbilitySelect)
  for (const [label, value, expected] of [
    ['Requirement subject', 'affected', { ...created, subject: 'affected' }],
    ['Other requirement subject', 'selected', { ...created, otherSubject: 'selected' }],
    ['Subject relation', 'enemy', { ...created, relation: 'enemy' }],
  ] as const) {
    const control = controls.find(
      (child: { props: { label: string } }) => child.props.label === label,
    )
    control.props.onChange(value)
    const edited = onChange.mock.calls.at(-1)![0]
    expect(edited).toEqual(expected)
    expect(validateAbilityRequirements(edited)).toEqual([])
  }
})
