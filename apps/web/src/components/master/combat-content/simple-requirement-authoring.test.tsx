import type { ComponentProps, ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import type { AbilityBehavior, RequirementNode } from '@aurevane/game-core/combat/combat-definition'
import { evaluateAbilityRequirements } from '@aurevane/game-core/combat/combat-requirements'
import { AbilityRequirementEditor } from './ability-requirement-editor'
import { AbilityNumber, AbilitySelect } from './ability-editor-fields'
import { AbilityDefinitionEditor, rebindSimpleRequirement } from './ability-definition-editor'
import {
  AbilityEffectEditor,
  defaultAbilityPayload,
  rebindSimpleEffectRequirement,
} from './ability-effect-editor'
import { SkillEffectEditor } from './skill-effect-editor'

function behavior(requirements: RequirementNode | null): AbilityBehavior {
  return {
    ...defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!,
    requirementMode: 'simple',
    requirements,
  }
}
function controls(value: unknown): ReactElement[] {
  if (!value || typeof value !== 'object' || !('props' in value)) return []
  const element = value as ReactElement<{ children?: unknown }>
  if (
    typeof element.type === 'function' &&
    [
      'AbilityRequirementEditor',
      'AbilityRequirementModulesEditor',
      'SimpleAbilityRequirementEditor',
    ].includes(element.type.name)
  )
    return [element, ...controls((element.type as (props: unknown) => ReactElement)(element.props))]
  return [element, ...[element.props.children].flat(Infinity).flatMap(controls)]
}
function editor(value: RequirementNode | null, changed = vi.fn()) {
  return <AbilityRequirementEditor behavior={behavior(value)} value={value} onChange={changed} />
}
function select(tree: ReactElement, label: string) {
  return controls(tree).find(
    (row) => row.type === AbilitySelect && (row.props as { label?: string }).label === label,
  ) as ReactElement<ComponentProps<typeof AbilitySelect>>
}

it('offers the predefined requirement tags and a single target without nested rule controls', () => {
  const html = renderToStaticMarkup(editor(null))
  expect(html).toContain('aria-label="Requirement tag"')
  for (const label of [
    'None',
    'Burn',
    'Drenched',
    'Primed',
    'HP less than',
    'HP more than',
    'MP less than',
    'MP more than',
  ])
    expect(html).toContain(label)
  expect(html).not.toMatch(
    /Trigger module|Action filter|All conditions|Any condition|Add condition|type="text"/,
  )
})

it('saves a tag and Target as the actual native status predicate', () => {
  const changed = vi.fn()
  select(editor(null, changed), 'Requirement tag').props.onChange('wet')
  const condition = changed.mock.calls.at(-1)![0] as RequirementNode
  select(editor(condition, changed), 'Requirement target').props.onChange('selected')
  const saved = JSON.parse(JSON.stringify(changed.mock.calls.at(-1)![0])) as RequirementNode
  expect(saved).toEqual({
    kind: 'status-presence',
    subject: 'selected',
    statusId: 'wet',
    present: true,
  })
  expect(evaluateAbilityRequirements(saved, { selected: { statusIds: ['wet'] } })).toBe(true)
  expect(evaluateAbilityRequirements(saved, { selected: { statusIds: [] } })).toBe(false)
})

it('programs MP less than with an editable percentage and rejects equality after JSON reload', () => {
  const changed = vi.fn()
  select(editor(null, changed), 'Requirement tag').props.onChange('mp-less-than')
  let condition = changed.mock.calls.at(-1)![0] as RequirementNode
  const number = controls(editor(condition, changed)).find(
    (row) =>
      row.type === AbilityNumber &&
      (row.props as { label?: string }).label === 'Requirement value (%)',
  ) as ReactElement<ComponentProps<typeof AbilityNumber>>
  number.props.onChange(25.5)
  condition = JSON.parse(JSON.stringify(changed.mock.calls.at(-1)![0])) as RequirementNode
  expect(condition).toEqual({
    kind: 'resource-state',
    subject: 'owner',
    resource: 'mp',
    comparison: 'less-than',
    basisPoints: 2550,
  })
  const context = (mp: number) => ({ owner: { resources: { mp }, maximumResources: { mp: 1000 } } })
  expect(evaluateAbilityRequirements(condition, context(254))).toBe(true)
  expect(evaluateAbilityRequirements(condition, context(255))).toBe(false)
  expect(evaluateAbilityRequirements(condition, context(256))).toBe(false)
  select(editor(condition, changed), 'Requirement tag').props.onChange('none')
  expect(changed.mock.calls.at(-1)![0]).toBeNull()
})

it('keeps invalid percentage edits from replacing the last executable condition', () => {
  const changed = vi.fn()
  const condition: RequirementNode = {
    kind: 'resource-state',
    subject: 'owner',
    resource: 'hp',
    comparison: 'more-than',
    basisPoints: 4000,
  }
  const number = controls(editor(condition, changed)).find(
    (row) => row.type === AbilityNumber,
  ) as ReactElement<ComponentProps<typeof AbilityNumber>>
  for (const value of [-1, 100.01, NaN, 33.333]) number.props.onChange(value)
  expect(changed).not.toHaveBeenCalled()
})

it('offers Conditional Cleanse in the canonical Master effect palette', () => {
  const html = renderToStaticMarkup(
    <AbilityDefinitionEditor
      value={{ schemaVersion: 1, behaviors: [behavior(null)] }}
      onChange={vi.fn()}
    />,
  )
  expect(html).toContain('<option value="conditional-cleanse">Conditional Cleanse</option>')
  expect(defaultAbilityPayload('conditional-cleanse')).toMatchObject({
    type: 'remove-status',
    removalMode: 'specified',
  })
})

it.each([
  ['actor', 'selected'],
  ['affected-units', 'affected'],
] as const)(
  'rebinds a Target effect condition when its recipient becomes %s',
  (recipient, subject) => {
    const changed = vi.fn()
    const value = {
      id: 'hit',
      payload: { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 10 },
      requirements: {
        kind: 'status-presence' as const,
        subject: 'selected' as const,
        statusId: 'wet',
        present: true,
      },
    }
    const tree = AbilityEffectEditor({ value, onChange: changed })
    const payloadEditor = controls(tree).find(
      (row) => row.type === SkillEffectEditor,
    ) as ReactElement<ComponentProps<typeof SkillEffectEditor>>
    payloadEditor.props.onChange({ ...value.payload, recipient })
    expect(changed.mock.calls.at(-1)![0]).toMatchObject({
      payload: { recipient },
      requirements: { ...value.requirements, subject },
    })
  },
)

it('preserves a selected enemy gate on a self benefit but rebinds it when geometry no longer selects a unit', () => {
  const effect = {
    id: 'heal',
    payload: { type: 'healing' as const, recipient: 'actor' as const, amount: 1 },
    requirements: {
      kind: 'status-presence' as const,
      subject: 'selected' as const,
      statusId: 'wet',
      present: true,
    },
  }
  const single = behavior(null)
  expect(rebindSimpleEffectRequirement(effect, single)).toEqual(effect)
  const circle = {
    ...single,
    targeting: {
      ...single.targeting!,
      shape: { kind: 'circle' as const, radius: 1 },
    },
  }
  expect(rebindSimpleEffectRequirement(effect, circle).requirements).toEqual({
    ...effect.requirements,
    subject: 'owner',
  })
})

it('rebinds an unavailable condition-entry target to Self', () => {
  const group: AbilityBehavior = {
    ...behavior(null),
    activation: 'automatic',
    automaticTarget: { subject: 'selected' },
    targeting: {
      ...behavior(null).targeting!,
      kind: 'self',
      teamPolicy: 'self',
      friendlyFire: 'allies-only',
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
    },
  }
  expect(rebindSimpleRequirement(group).automaticTarget).toEqual({ subject: 'owner' })
})
it('removes a stale unit binding when an automatic group becomes an owner-activated area', () => {
  const group: AbilityBehavior = {
    ...behavior(null),
    activation: 'automatic',
    automaticTarget: { subject: 'selected' },
    targeting: {
      ...behavior(null).targeting!,
      geometryVersion: 2,
      minimumRange: 0,
      maximumRange: 1,
      shape: { kind: 'circle', radius: 1 },
    },
  }
  expect(rebindSimpleRequirement(group).automaticTarget).toBeUndefined()
})
