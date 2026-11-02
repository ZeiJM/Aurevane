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
import { capturedResonanceAbilitySource } from '@aurevane/game-core/combat/combat-action-source'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { percentageDotEncounter } from '../../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import {
  finishPv1fTurn,
  preparePv1fTurnEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { abilityBehaviorInformation } from '../../character/ability-detail-presentation'
import { SIMPLE_AUTOMATIC_TRIGGER_OPTIONS } from '@aurevane/game-core/combat/combat-simple-requirements'

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
  'ResonanceRequirementsEditor',
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

function executeSavedResonance(saved: AbilityDefinition) {
  const initial = preparePv1fTurnEconomy(percentageDotEncounter())
  const current = resolveResonanceForPair('wildwarden', 'edgedancer')!
  const captured = capturedResonanceAbilitySource(
    initial,
    'enemy',
    { ...current, ability: saved },
    current.disciplinePair,
  )!
  const state = reconcileCombatAbilitySources(initial, [captured]) as typeof initial
  const before = structuredClone(state)
  const out = finishPv1fTurn(state, 'west')
  expect(state).toEqual(before)
  expect(out.state.capturedAbilitySources).toContainEqual(captured)
  return out
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
it.each(
  (['attack', 'utility', 'recovery'] as const).flatMap((classification) =>
    (['self', 'all'] as const).map((target) => ({ classification, target })),
  ),
)(
  'omits redundant $classification $target aiming and executes the saved effect recipients',
  ({ classification, target }) => {
    const editor = fixture(classification)
    if (target === 'all') change(editor.tree('effects'), 'Target', 'all')
    const before = structuredClone(editor.value())
    expect(renderToStaticMarkup(editor.tree('details'))).not.toContain(
      'aria-label="Automatic target subject"',
    )
    expect(editor.value()).toEqual(before)
    const saved = parseAbilityDefinition(JSON.parse(JSON.stringify(editor.value())))
    expect(saved.behaviors[0]!.automaticTarget).toEqual({ subject: 'owner' })
    expect(saved.behaviors[0]!.effects[0]!.payload).toMatchObject({ target })

    const out = executeSavedResonance(saved)
    const recipients = out.events.flatMap((event) =>
      typeof event === 'object' &&
      event !== null &&
      'event' in event &&
      event.event === 'status_applied' &&
      'statusId' in event &&
      event.statusId === 'guarded' &&
      'targetCombatantId' in event
        ? [event.targetCombatantId]
        : [],
    )
    expect(recipients.sort()).toEqual(
      target === 'all' ? ['actor', 'ally', 'enemy', 'other'] : ['enemy'],
    )
  },
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
    const out = executeSavedResonance(saved)
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'status_applied',
        sourceCombatantId: 'enemy',
        targetCombatantId: selector.endsWith('ally') ? 'other' : 'actor',
        statusId: 'guarded',
      }),
    )
    expect(out.events).not.toContainEqual(
      expect.objectContaining({
        event: 'status_applied',
        targetCombatantId: 'enemy',
        statusId: 'guarded',
      }),
    )
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

it.each(['attack', 'utility', 'recovery'] as const)(
  'omits the sole valid Self rule for advanced %s actions without changing the saved binding',
  (classification) => {
    const editor = fixture(classification)
    const group = { ...editor.value().behaviors[0]! }
    delete group.requirementMode
    delete group.automaticTrigger
    editor.replace({ schemaVersion: 1, behaviors: [group] })
    const before = structuredClone(editor.value())
    expect(renderToStaticMarkup(editor.tree('details'))).not.toContain(
      'aria-label="Automatic target subject"',
    )
    expect(editor.value()).toEqual(before)
    expect(parseAbilityDefinition(editor.value()).behaviors[0]!.automaticTarget).toEqual({
      subject: 'owner',
    })
  },
)

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
  // Existing event-plus-predicate definitions remain literal; the new picker does not create them.
  const saved = editor.value()
  editor.replace({
    ...saved,
    behaviors: [
      {
        ...saved.behaviors[0]!,
        requirements: {
          kind: 'status-presence',
          subject: 'selected',
          statusId: 'wet',
          present: true,
        },
      },
    ],
  })
  expect(
    parseAbilityDefinition(JSON.parse(JSON.stringify(editor.value()))).behaviors[0],
  ).toMatchObject({
    automaticTrigger: 'turn-started',
    automaticTarget: { subject: 'nearest-enemy' },
    requirements: { kind: 'status-presence', subject: 'selected', statusId: 'wet', present: true },
    effects: [{ payload: { target: 'enemy' } }],
  })
})

it('puts event selection inside Requirements and hides tag/target controls for automatic activation', () => {
  const editor = fixture('utility')
  const html = renderToStaticMarkup(editor.tree('details'))
  expect(html).toContain('aria-label="Requirement type"')
  const requirements = html.slice(html.indexOf('data-resonance-requirements="true"'))
  expect(requirements).toContain('<legend>Requirements</legend>')
  expect(requirements).toContain('aria-label="Automatic activation"')
  expect(html).not.toContain('aria-label="Requirement tag"')
  expect(html).not.toContain('aria-label="Requirement target"')
  expect(html).not.toContain('When requirement becomes true')
  expect(html).not.toContain('When Requirements Are Satisfied')
})

it.each(SIMPLE_AUTOMATIC_TRIGGER_OPTIONS.filter(({ id }) => id !== 'requirements-met'))(
  'roundtrips $label from the event picker into canonical Requirements',
  ({ id, label }) => {
    const editor = fixture('utility')
    change(editor.tree('details'), 'Automatic activation', id)
    const saved = parseAbilityDefinition(JSON.parse(JSON.stringify(editor.value())))
    expect(saved.behaviors[0]!.automaticTrigger).toBe(id)
    expect(
      Object.fromEntries(abilityBehaviorInformation(saved.behaviors[0]!).rows).Requirements,
    ).toBe(label)
    expect(saved.behaviors[0]!.requirements).toBeNull()
  },
)

it('switches from event to prerequisite tags and explicitly replaces tags when choosing an event', () => {
  const editor = fixture('utility')
  change(editor.tree('details'), 'Requirement type', 'tags')
  change(editor.tree('details'), 'Requirement tag', 'wet')
  change(editor.tree('details'), 'Requirement target', 'owner')
  let saved = parseAbilityDefinition(JSON.parse(JSON.stringify(editor.value())))
  expect(saved.behaviors[0]!.automaticTrigger).toBeUndefined()
  expect(
    Object.fromEntries(abilityBehaviorInformation(saved.behaviors[0]!).rows).Requirements,
  ).toBe('Drenched [Self]')
  expect(renderToStaticMarkup(editor.tree('details'))).not.toContain(
    'aria-label="Automatic activation"',
  )
  change(editor.tree('details'), 'Requirement type', 'automatic')
  saved = parseAbilityDefinition(JSON.parse(JSON.stringify(editor.value())))
  expect(saved.behaviors[0]!.requirements).toBeNull()
  expect(saved.behaviors[0]!.automaticTrigger).toBe('turn-started')
  expect(executeSavedResonance(saved).events).toContainEqual(
    expect.objectContaining({
      event: 'status_applied',
      targetCombatantId: 'enemy',
      statusId: 'guarded',
    }),
  )
})

it.each([undefined, 'requirements-met'] as const)(
  'opens historical prerequisite activation %s without rewriting it',
  (automaticTrigger) => {
    const editor = fixture('utility')
    editor.replace({
      ...editor.value(),
      behaviors: [
        {
          ...editor.value().behaviors[0]!,
          automaticTrigger,
          requirements: {
            kind: 'status-presence',
            subject: 'owner',
            statusId: 'wet',
            present: true,
          },
        },
      ],
    })
    const before = structuredClone(editor.value())
    const html = renderToStaticMarkup(editor.tree('details'))
    expect(html).toContain('aria-label="Requirement tag"')
    expect(html).toContain('aria-label="Requirement target"')
    expect(html).not.toContain('aria-label="Automatic activation"')
    expect(editor.value()).toEqual(before)
    expect(parseAbilityDefinition(JSON.parse(JSON.stringify(before)))).toEqual(
      JSON.parse(JSON.stringify(before)),
    )
  },
)

it('preserves and reports historical combined predicates without exposing a hidden Requirement target', () => {
  const editor = fixture('utility')
  editor.replace({
    ...editor.value(),
    behaviors: [
      {
        ...editor.value().behaviors[0]!,
        requirements: { kind: 'status-presence', subject: 'owner', statusId: 'wet', present: true },
      },
    ],
  })
  const before = structuredClone(editor.value())
  const html = renderToStaticMarkup(editor.tree('details'))
  expect(html).toContain('Retained prerequisite:')
  expect(html).toContain('Drenched [Self]')
  expect(html).not.toContain('aria-label="Requirement target"')
  expect(editor.value()).toEqual(before)
  const saved = parseAbilityDefinition(JSON.parse(JSON.stringify(before)))
  expect(
    Object.fromEntries(abilityBehaviorInformation(saved.behaviors[0]!).rows).Requirements,
  ).toBe('Your Turn Starts; Drenched [Self]')
  expect(executeSavedResonance(saved).events).not.toContainEqual(
    expect.objectContaining({
      event: 'status_applied',
      targetCombatantId: 'enemy',
      statusId: 'guarded',
    }),
  )
})
