import { readFileSync } from 'node:fs'
import type { ComponentProps, ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type {
  AbilityDefinition,
  RequirementNode,
} from '@aurevane/game-core/combat/combat-definition'
import {
  evaluateAbilityRequirements,
  validateAbilityRequirements,
} from '@aurevane/game-core/combat/combat-requirements'
import { AbilityRequirementEditor } from './ability-requirement-editor'
import { AbilityRequirementModulesEditor } from './ability-requirement-modules-editor'
import { AbilityNumber, AbilitySelect } from './ability-editor-fields'

type Row = { id: string; kind: string; after: { ability: AbilityDefinition } }
const catalogue = new Map<string, Row>()
for (const name of [
  '2026-10-18-modular-correction-cohort',
  '2026-10-19-essence-resonance-identity-cohort',
  '2026-10-19-resonance-modularity-cohort',
]) {
  const rows: Row[] = JSON.parse(
    readFileSync(
      new URL(`../../../../../../docs/superpowers/specs/${name}.json`, import.meta.url),
      'utf8',
    ),
  ).records
  for (const row of rows) catalogue.set(row.id, row)
}
function controls(
  value: unknown,
): ReactElement<{ children?: unknown; label?: string; value?: unknown }>[] {
  if (!value || typeof value !== 'object' || !('props' in value)) return []
  const element = value as ReactElement<{ children?: unknown; label?: string; value?: unknown }>
  return [element, ...[element.props.children].flat(Infinity).flatMap(controls)]
}
it.each([...catalogue.values()].filter((row) => row.kind === 'resonance'))(
  '$id offers finite requirement modules without free-text rules',
  (row) => {
    const behavior = row.after.ability.behaviors[0]!
    const html = renderToStaticMarkup(
      <AbilityRequirementModulesEditor
        behavior={behavior}
        value={behavior.requirements}
        onChange={vi.fn()}
      />,
    )
    expect(html).not.toContain('type="text"')
    expect(html).not.toContain('Primed ability identity')
    expect(html).not.toContain('comma separated')
    expect(html).toContain('data-requirement-modules="true"')
    if (behavior.activation === 'automatic') expect(html).toContain('aria-label="Trigger module"')
  },
)
it('creates generic Primed as an executable module without an ability ID', () => {
  const changed = vi.fn()
  const tree = AbilityRequirementEditor({ value: null, onChange: changed })
  const kind = controls(tree).find(
    (control) => control.type === AbilitySelect && control.props.label === 'Requirement kind',
  )!
  ;(kind as ReactElement<ComponentProps<typeof AbilitySelect>>).props.onChange('prime-presence')
  const next = changed.mock.calls[0]![0] as RequirementNode
  expect(next).toEqual({ kind: 'prime-presence', subject: 'owner', present: true })
  expect(validateAbilityRequirements(next)).toEqual([])
  expect(
    evaluateAbilityRequirements(next, { owner: { primeAbilityIds: ['another.controlled-skill'] } }),
  ).toBe(true)
})
it('an edited MP threshold survives module recombination and changes authoritative eligibility', () => {
  const behavior = catalogue.get('resonance.aetherist-chronist.linked-sequence')!.after.ability
    .behaviors[0]!
  const changed = vi.fn()
  const tree = AbilityRequirementModulesEditor({
    behavior,
    value: behavior.requirements,
    onChange: changed,
  })
  const slot = controls(tree).find(
    (control) =>
      control.type === AbilityRequirementEditor &&
      (control.props.value as RequirementNode | null)?.kind === 'resource-state',
  )!
  const editor = AbilityRequirementEditor(
    (slot as ReactElement<ComponentProps<typeof AbilityRequirementEditor>>).props,
  )
  const number = controls(editor).find(
    (control) => control.type === AbilityNumber && control.props.label === 'Resource threshold',
  )!
  ;(number as ReactElement<ComponentProps<typeof AbilityNumber>>).props.onChange(13)
  const persisted = JSON.parse(JSON.stringify(changed.mock.calls.at(-1)![0])) as RequirementNode
  expect(validateAbilityRequirements(persisted)).toEqual([])
  expect(
    evaluateAbilityRequirements(persisted, {
      owner: { primeAbilityIds: ['custom.controlled'], resources: { mp: 12 } },
    }),
  ).toBe(false)
  expect(
    evaluateAbilityRequirements(persisted, {
      owner: { primeAbilityIds: ['custom.controlled'], resources: { mp: 13 } },
    }),
  ).toBe(true)
})

it('keeps the last action qualifier executable when an empty selection is attempted', () => {
  const base = catalogue.get('resonance.cinderweaver-ravager.linked-sequence')!.after.ability
    .behaviors[0]!
  const changed = vi.fn()
  const initial = AbilityRequirementModulesEditor({
    behavior: base,
    value: base.requirements,
    onChange: changed,
  })
  const trigger = controls(initial).find(
    (control) => control.type === AbilitySelect && control.props.label === 'Trigger module',
  )! as ReactElement<ComponentProps<typeof AbilitySelect>>
  trigger.props.onChange('trigger.after-action')
  const requirement = changed.mock.calls.at(-1)![0] as RequirementNode
  const tree = AbilityRequirementModulesEditor({
    behavior: { ...base, requirements: requirement },
    value: requirement,
    onChange: changed,
  })
  const slot = controls(tree).find(
    (control) =>
      control.type === AbilityRequirementEditor &&
      (control.props.value as RequirementNode | null)?.kind === 'action',
  )! as ReactElement<ComponentProps<typeof AbilityRequirementEditor>>
  const action = AbilityRequirementEditor(slot.props)
  const classification = controls(action).find(
    (control) =>
      control.type === AbilitySelect && control.props.label === 'Required action classification',
  )! as ReactElement<ComponentProps<typeof AbilitySelect>>
  expect(classification.props.options).not.toContain('')
  const calls = changed.mock.calls.length
  expect(() => classification.props.onChange('')).not.toThrow()
  expect(changed).toHaveBeenCalledTimes(calls)
  expect(validateAbilityRequirements(requirement)).toEqual([])
})

it('offers only Self for maintained Primed and resource conditions', () => {
  const behavior = catalogue.get('resonance.aetherist-chronist.linked-sequence')!.after.ability
    .behaviors[0]!
  const tree = AbilityRequirementModulesEditor({
    behavior,
    value: behavior.requirements,
    onChange: vi.fn(),
  })
  for (const slot of controls(tree).filter(
    (control) => control.type === AbilityRequirementEditor,
  )) {
    const condition = AbilityRequirementEditor(
      (slot as ReactElement<ComponentProps<typeof AbilityRequirementEditor>>).props,
    )
    const subject = controls(condition).find(
      (control) => control.type === AbilitySelect && control.props.label === 'Requirement subject',
    )! as ReactElement<ComponentProps<typeof AbilitySelect>>
    expect(subject.props.options).toEqual(['owner'])
  }
})
