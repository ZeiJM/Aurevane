import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  parseAbilityDefinition,
  type AbilityBehavior,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { AbilityDefinitionEditor } from './ability-definition-editor'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useId: () => ':automatic:',
  useState: (initial: unknown) => [initial, () => {}],
}))

type Props = Record<string, unknown> & { children?: ReactNode }
const expanded = new Set([
  'AbilityGroupEditor',
  'AbilityEffectEditor',
  'SkillEffectEditor',
  'EffectTargetEditor',
  'AbilitySelect',
  'AbilityRequirementEditor',
  'SimpleAbilityRequirementEditor',
])
function controls(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(controls)
  if (!isValidElement<Props>(node)) return []
  return [
    node,
    ...(typeof node.type === 'function' && expanded.has(node.type.name)
      ? controls((node.type as (props: Props) => ReactNode)(node.props))
      : controls(node.props.children)),
  ]
}
function change(tree: ReactNode, label: string, value: string) {
  const field = controls(tree).find(
    (node) => node.type === 'select' && node.props['aria-label'] === label,
  )!
  expect(field, label).toBeDefined()
  ;(field.props.onChange as (event: unknown) => void)({ currentTarget: { value } })
}
function fixture(classification: AbilityBehavior['classification']) {
  const { attackFamily: _family, ...base } = defaultBasicSkills().find(
    (row) => row.id === 'unarmed.basic',
  )!.ability.behaviors[0]!
  void _family
  let value: AbilityDefinition = {
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        id: 'reaction',
        classification,
        ...(classification === 'attack' ? { attackFamily: 'physical' } : {}),
        activation: 'automatic',
        mode: 'action',
        requirementMode: 'simple',
        automaticTrigger: 'turn-started',
        requirements: null,
        automaticTarget: { subject: 'owner' },
        targeting: {
          ...base.targeting!,
          kind: 'self',
          geometryVersion: 3,
          categories: ['self'],
          teamPolicy: 'self',
          minimumRange: 0,
          maximumRange: 0,
          maximumSelections: 1,
          requiresLineOfSight: false,
          friendlyFire: 'allies-only',
        },
        effects: [
          {
            id: 'guard',
            payload: {
              type: 'apply-status',
              recipient: 'actor',
              target: 'self',
              statusId: 'guarded',
              stacks: 1,
              durationTurns: 2,
            },
          },
        ],
      },
    ],
  }
  const tree = (section: 'details' | 'effects') =>
    AbilityDefinitionEditor({
      value,
      section,
      category: 'passive',
      onChange: (next) => {
        value = next
      },
    })
  return {
    value: () => value,
    replace: (next: AbilityDefinition) => {
      value = next
    },
    tree,
  }
}

const rules = {
  enemy: ['nearest-enemy', 'lowest-hp-enemy'],
  ally: ['nearest-ally', 'lowest-hp-ally'],
  ground: ['nearest-enemy', 'nearest-ally', 'lowest-hp-enemy', 'lowest-hp-ally'],
} as const
const selectorCases = (['attack', 'utility', 'recovery'] as const).flatMap((classification) =>
  (['enemy', 'ally', 'ground'] as const).flatMap((target) =>
    rules[target].map((selector) => ({ classification, target, selector })),
  ),
)
it.each(selectorCases)(
  'programs $classification $target targeting with $selector and saves the chosen turn-start rule through actual controls',
  ({ classification, target, selector }) => {
    const editor = fixture(classification)
    change(editor.tree('effects'), 'Target', target)
    const html = renderToStaticMarkup(editor.tree('details'))
    const nearest = target === 'ally' ? 'Nearest ally' : 'Nearest enemy'
    expect(html).toContain(nearest)
    expect(html).toContain(target === 'ally' ? 'Lowest HP ally' : 'Lowest HP enemy')
    expect(html).not.toContain('Choose Self targeting')
    expect(html).toContain('Self effects stay on the caster')
    change(editor.tree('details'), 'Automatic target subject', selector)
    const saved = parseAbilityDefinition(JSON.parse(JSON.stringify(editor.value())))
    expect(saved.behaviors[0]).toMatchObject({
      classification,
      automaticTrigger: 'turn-started',
      automaticTarget: { subject: selector },
      effects: [{ id: 'guard', payload: { target } }],
    })
    if (target === 'ground') {
      expect(saved.behaviors[0]!.groundArea?.entryEffectIds).toEqual(['guard'])
      expect(html).toContain('Own Ground tile')
      expect(html).toContain('Ground uses the chosen unit’s tile')
      for (const label of ['Nearest enemy', 'Nearest ally', 'Lowest HP enemy', 'Lowest HP ally'])
        expect(html).toContain(label)
    }
  },
)

it('adds compatible selectors to advanced automatic actions while retaining every causal role label', () => {
  const editor = fixture('utility')
  change(editor.tree('effects'), 'Target', 'enemy')
  const value = editor.value()
  const group = {
    ...value.behaviors[0]!,
    requirements: {
      kind: 'event' as const,
      eventType: 'combat_action_used',
      phase: 'after' as const,
    },
    automaticTarget: { subject: 'triggering' as const },
  }
  delete group.requirementMode
  delete group.automaticTrigger
  editor.replace({ ...value, behaviors: [group] })
  const html = renderToStaticMarkup(editor.tree('details'))
  for (const label of [
    'Self',
    'Triggering unit',
    'Action target',
    'Affected unit',
    'Nearest enemy',
    'Lowest HP enemy',
  ])
    expect(html).toContain(label)
  change(editor.tree('details'), 'Automatic target subject', 'nearest-enemy')
  expect(parseAbilityDefinition(editor.value()).behaviors[0]!.automaticTarget).toEqual({
    subject: 'nearest-enemy',
  })
})

it('does not offer spatial rules for Self-only effects or mutate incompatible raw drafts on render', () => {
  const editor = fixture('recovery')
  const html = renderToStaticMarkup(editor.tree('details'))
  expect(html).not.toContain('Nearest enemy')
  expect(html).not.toContain('Lowest HP ally')
  const invalid = {
    ...editor.value(),
    behaviors: [
      { ...editor.value().behaviors[0]!, automaticTarget: { subject: 'nearest-enemy' as const } },
    ],
  }
  const before = structuredClone(invalid)
  editor.replace(invalid)
  expect(renderToStaticMarkup(editor.tree('details'))).toContain('Nearest enemy (incompatible)')
  expect(editor.value()).toEqual(before)
  expect(() => parseAbilityDefinition(invalid)).toThrow()
})

it('keeps ongoing passive modifiers outside the automatic action selector', () => {
  const editor = fixture('utility')
  const ongoing = {
    ...editor.value().behaviors[0]!,
    activation: 'ongoing' as const,
    mode: 'modifier' as const,
    targeting: null,
  }
  delete ongoing.automaticTarget
  delete ongoing.automaticTrigger
  editor.replace({ schemaVersion: 1, behaviors: [ongoing] })
  expect(renderToStaticMarkup(editor.tree('details'))).not.toContain(
    'aria-label="Automatic target subject"',
  )
})
it('exposes candidate Target conditions once a turn-start spatial rule supplies the unit', () => {
  const editor = fixture('utility')
  change(editor.tree('effects'), 'Target', 'enemy')
  change(editor.tree('details'), 'Automatic target subject', 'nearest-enemy')
  change(editor.tree('details'), 'Requirement tag', 'wet')
  change(editor.tree('details'), 'Requirement target', 'selected')
  expect(
    parseAbilityDefinition(JSON.parse(JSON.stringify(editor.value()))).behaviors[0],
  ).toMatchObject({
    automaticTrigger: 'turn-started',
    automaticTarget: { subject: 'nearest-enemy' },
    requirements: { kind: 'status-presence', subject: 'selected', statusId: 'wet', present: true },
    effects: [{ payload: { target: 'enemy' } }],
  })
})
