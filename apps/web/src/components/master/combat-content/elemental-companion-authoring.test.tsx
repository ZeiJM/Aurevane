import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import {
  validateAbilityDefinition,
  type AbilityBehavior,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { ContentDefinitionFields } from './content-definition-fields'
import type { CombatContentDefinition } from '@aurevane/db/combat-content'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import {
  validateSkillDefinition,
  validateEssenceAuthoringDefinition,
  validateResonanceAuthoringDefinition,
} from '@/server/master/combat-content-authoring-validation'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
vi.mock('server-only', () => ({}))

// Minimal mechanical copy of the read-only current Kamehameha Essence, without identity/media.
function kamehameha(): AbilityBehavior {
  return {
    id: 'main',
    mode: 'action',
    activation: 'manual',
    classification: 'attack',
    attackFamily: 'physical',
    costs: [
      { resource: 'ap', amount: 40 },
      { resource: 'hp', amount: 20 },
      { resource: 'mp', amount: 20 },
    ],
    cooldown: { key: 'test-beam', ownerTurns: 1 },
    requirementMode: 'simple',
    requirements: {
      kind: 'status-presence',
      subject: 'owner',
      statusId: 'inspired',
      present: true,
    },
    activationLimits: ['once-per-round'],
    accuracy: { kind: 'standard' },
    targeting: {
      geometryVersion: 2,
      kind: 'unit',
      teamPolicy: 'enemy',
      friendlyFire: 'enemies-only',
      minimumRange: 0,
      maximumRange: 5,
      maximumSelections: 1,
      shape: { kind: 'line', length: 5 },
      maximumElevationDifference: 3,
      requiresLineOfSight: false,
    },
    effects: [
      {
        id: 'effect-1',
        payload: { type: 'damage', amount: 20, recipient: 'affected-units', durationTurns: 0 },
      },
    ],
  }
}
function controls(value: unknown): ReactElement<Record<string, unknown>>[] {
  if (!value || typeof value !== 'object' || !('props' in value)) return []
  const element = value as ReactElement<Record<string, unknown>>
  if (
    typeof element.type === 'function' &&
    [
      'ContentDefinitionFields',
      'SkillMechanics',
      'AbilityDefinitionEditor',
      'AbilityGroupEditor',
      'AbilityEffectEditor',
      'SkillEffectEditor',
      'EffectTargetEditor',
      'AbilityTargetingEditor',
      'SkillTargetingEditor',
    ].includes(element.type.name)
  )
    return [element, ...controls((element.type as (props: unknown) => ReactElement)(element.props))]
  return [element, ...[element.props.children].flat(Infinity).flatMap(controls)]
}
function editor(group = kamehameha()) {
  let draft: AbilityDefinition = { schemaVersion: 1, behaviors: [group] }
  let notes: readonly (string | null)[] = group.effects.map((_, index) =>
    index === 0 ? 'Retain this authored damage note.' : null,
  )
  const tree = () => (
    <AbilityDefinitionEditor
      value={draft}
      effectDescriptions={notes}
      onChange={(next, descriptions) => {
        draft = next
        notes = descriptions
      }}
    />
  )
  return {
    draft: () => draft,
    notes: () => notes,
    tree,
    change(label: string, value: string, index = 0) {
      const control = controls(tree()).filter(
        (node) =>
          (node.type === 'select' || node.type === 'input') && node.props['aria-label'] === label,
      )[index]
      expect(control, label).toBeDefined()
      ;(control!.props.onChange as (event: unknown) => void)({ currentTarget: { value } })
    },
  }
}
it.each([
  ['ice', 'frozen'],
  ['water', 'wet'],
  ['storm', 'conductive'],
  ['fire', 'cleanse'],
] as const)(
  'adds exactly the required %s companion when editing the actual beam shape',
  (element, status) => {
    const e = editor()
    const before = structuredClone(e.draft())
    renderToStaticMarkup(e.tree())
    expect(e.draft()).toEqual(before)
    e.change('Element', element)
    const group = e.draft().behaviors[0]!
    expect(group.effects).toHaveLength(2)
    expect(group.effects[1]!.payload).toMatchObject(
      status === 'cleanse'
        ? { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] }
        : {
            type: 'apply-status',
            recipient: 'affected-units',
            statusId: status,
            stacks: 1,
            durationTurns: 2,
          },
    )
    expect(group).toMatchObject({
      costs: before.behaviors[0]!.costs,
      targeting: before.behaviors[0]!.targeting,
      requirements: before.behaviors[0]!.requirements,
    })
    expect(e.notes()).toEqual(['Retain this authored damage note.', null])
    expect(validateAbilityDefinition(e.draft())).toEqual([])
  },
)
it('replaces/removes only the requisite generated tags through successive element changes', () => {
  const original = kamehameha()
  const unrelated = {
    id: 'manual-mark',
    payload: {
      type: 'apply-status' as const,
      recipient: 'actor' as const,
      statusId: 'mark',
      stacks: 1,
      durationTurns: 3,
    },
  }
  const e = editor({ ...original, effects: [...original.effects, unrelated] })
  for (const [element, status] of [
    ['ice', 'frozen'],
    ['water', 'wet'],
    ['storm', 'conductive'],
    ['fire', 'cleanse'],
    ['', 'none'],
  ] as const) {
    e.change('Element', element)
    const effects = e.draft().behaviors[0]!.effects
    expect(effects.find((row) => row.id === unrelated.id)).toEqual(unrelated)
    expect(effects).toHaveLength(element ? 3 : 2)
    if (status !== 'none')
      expect(effects.at(-1)!.payload).toMatchObject(
        status === 'cleanse' ? { type: 'remove-status' } : { statusId: status },
      )
    expect(validateAbilityDefinition(e.draft())).toEqual([])
  }
})
it('repairs a missing companion on the next explicit element edit without clearing the recovered draft', () => {
  const original = kamehameha()
  const payload = original.effects[0]!.payload
  const e = editor({
    ...original,
    effects: [
      { ...original.effects[0]!, payload: { ...payload, element: 'ice' } as typeof payload },
    ],
  })
  expect(validateAbilityDefinition(e.draft())).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'elemental-companion' })]),
  )
  e.change('Element', 'water')
  expect(e.draft().behaviors[0]!.effects).toHaveLength(2)
  expect(e.draft().behaviors[0]!.effects[1]!.payload).toMatchObject({ statusId: 'wet' })
  expect(e.draft().behaviors[0]!.targeting).toEqual(original.targeting)
  expect(validateAbilityDefinition(e.draft())).toEqual([])
})

it('keeps one companion while another damage packet still needs the element', () => {
  const original = kamehameha()
  const e = editor({
    ...original,
    effects: [...original.effects, { ...original.effects[0]!, id: 'second-hit' }],
  })
  e.change('Element', 'ice', 0)
  e.change('Element', 'ice', 1)
  expect(e.draft().behaviors[0]!.effects).toHaveLength(3)
  const companion = e.draft().behaviors[0]!.effects[2]!
  e.change('Element', '', 0)
  expect(e.draft().behaviors[0]!.effects[2]).toEqual(companion)
  e.change('Element', '', 1)
  expect(e.draft().behaviors[0]!.effects).toHaveLength(2)
})

it('retargets a generated companion with damage through unit, area and global delivery', () => {
  const original = kamehameha()
  const e = editor({
    ...original,
    targeting: { ...original.targeting!, shape: { kind: 'single' } },
    effects: [{ id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } }],
  })
  e.change('Element', 'water')
  const id = e.draft().behaviors[0]!.effects[1]!.id
  e.change('Shape', 'circle')
  expect(e.draft().behaviors[0]!.effects.map((row) => row.payload.recipient)).toEqual([
    'affected-units',
    'affected-units',
  ])
  expect(e.draft().behaviors[0]!.effects[1]!.id).toBe(id)
  expect(validateAbilityDefinition(e.draft())).toEqual([])
  e.change('Shape', 'single')
  e.change('Target', 'all', 0)
  expect(e.draft().behaviors[0]!.effects[1]!.payload).toMatchObject({
    target: 'all',
    recipient: 'affected-units',
  })
  expect(validateAbilityDefinition(e.draft())).toEqual([])
  e.change('Target', 'enemy', 0)
  expect(e.draft().behaviors[0]!.effects[1]!.payload).toMatchObject({ target: 'enemy' })
  expect(validateAbilityDefinition(e.draft())).toEqual([])
})

it('removes an unambiguous standard preexisting companion only on explicit element removal', () => {
  const original = kamehameha()
  const damage = original.effects[0]!
  const companion = {
    id: 'historical-chilled',
    payload: {
      type: 'apply-status' as const,
      recipient: 'affected-units' as const,
      statusId: 'frozen',
      stacks: 1,
      durationTurns: 2,
    },
  }
  const group = {
    ...original,
    effects: [
      { ...damage, payload: { ...damage.payload, element: 'ice' } as typeof damage.payload },
      companion,
    ],
  }
  const e = editor(group)
  renderToStaticMarkup(e.tree())
  expect(e.draft().behaviors[0]!.effects[1]).toEqual(companion)
  e.change('Element', '')
  expect(e.draft().behaviors[0]!.effects).toHaveLength(1)
})

it('preserves manual conditional/custom duplicate tags and lets strict validation expose conflicts', () => {
  const original = kamehameha()
  const custom = {
    id: 'manual-chilled',
    requirements: {
      kind: 'status-presence' as const,
      subject: 'owner' as const,
      statusId: 'burn',
      present: true,
    },
    payload: {
      type: 'apply-status' as const,
      recipient: 'affected-units' as const,
      statusId: 'frozen',
      stacks: 1,
      durationTurns: 4,
    },
  }
  const e = editor({ ...original, effects: [...original.effects, custom] })
  e.change('Element', 'ice')
  expect(e.draft().behaviors[0]!.effects).toHaveLength(2)
  expect(e.draft().behaviors[0]!.effects[1]).toEqual(custom)
  expect(validateAbilityDefinition(e.draft())).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'elemental-companion' })]),
  )
  e.change('Element', '')
  expect(e.draft().behaviors[0]!.effects[1]).toEqual(custom)
})

it('offers a bounded recovery action for an already-invalid local draft without changing it on read', () => {
  const original = kamehameha()
  const damage = original.effects[0]!
  const e = editor({
    ...original,
    effects: [
      { ...damage, payload: { ...damage.payload, element: 'ice' } as typeof damage.payload },
    ],
  })
  const before = structuredClone(e.draft())
  renderToStaticMarkup(e.tree())
  expect(e.draft()).toEqual(before)
  const button = controls(e.tree()).find(
    (node) => node.type === 'button' && node.props.children === 'Add required elemental tags',
  )
  expect(button).toBeDefined()
  ;(button!.props.onClick as () => void)()
  expect(e.draft().behaviors[0]!.effects).toHaveLength(2)
  expect(e.draft().behaviors[0]!.targeting).toEqual(original.targeting)
  expect(e.notes()).toEqual(['Retain this authored damage note.', null])
  expect(validateAbilityDefinition(e.draft())).toEqual([])
})

it.each(['skill', 'essence', 'resonance'] as const)(
  'submits valid element transitions and aligned notes through the strict %s authoring boundary',
  (kind) => {
    const ability: AbilityDefinition = { schemaVersion: 1, behaviors: [kamehameha()] }
    const original =
      kind === 'skill'
        ? {
            ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
            ability,
            effectDescriptions: [null],
          }
        : kind === 'resonance'
          ? { ...resolveResonanceForPair('wildwarden', 'edgedancer')!, ability }
          : {
              ...resolveEssenceForBuild('vanguard', null)!,
              skill: {
                ...resolveEssenceForBuild('vanguard', null)!.skill,
                ability,
                effectDescriptions: [null],
              },
            }
    let definition = original as unknown as CombatContentDefinition
    const validate =
      kind === 'skill'
        ? validateSkillDefinition
        : kind === 'essence'
          ? validateEssenceAuthoringDefinition
          : validateResonanceAuthoringDefinition
    expect(validate(definition).issues).toEqual([])
    const tree = () => (
      <ContentDefinitionFields
        kind={kind}
        value={definition}
        tab="Parameters"
        abilitySection="effects"
        onChange={(next) => {
          definition = next
        }}
      />
    )
    for (const element of ['ice', 'water', 'storm', 'fire', '']) {
      const control = controls(tree()).find(
        (node) => node.type === 'select' && node.props['aria-label'] === 'Element',
      )!
      expect(control).toBeDefined()
      ;(control.props.onChange as (event: unknown) => void)({ currentTarget: { value: element } })
      definition = JSON.parse(JSON.stringify(definition)) as CombatContentDefinition
      expect(validate(definition).issues).toEqual([])
      const body = kind === 'essence' ? (definition.skill as CombatContentDefinition) : definition
      const saved = body.ability as AbilityDefinition
      expect(saved.behaviors[0]!.effects).toHaveLength(element ? 2 : 1)
      if (kind !== 'resonance') expect(body.effectDescriptions).toHaveLength(element ? 2 : 1)
      expect(saved.behaviors[0]!.targeting).toEqual(ability.behaviors[0]!.targeting)
      expect(saved.behaviors[0]!.costs).toEqual(ability.behaviors[0]!.costs)
    }
  },
)

it('does not let a generated tag broaden the shared aim beyond mixed Ally/Enemy damage', () => {
  const original = kamehameha()
  const e = editor({
    ...original,
    effects: [
      {
        id: 'enemy-hit',
        payload: { type: 'damage', recipient: 'affected-units', target: 'enemy', amount: 1 },
      },
      {
        id: 'ally-hit',
        payload: { type: 'damage', recipient: 'affected-units', target: 'ally', amount: 1 },
      },
    ],
  })
  e.change('Element', 'ice', 0)
  e.change('Element', 'ice', 1)
  const group = e.draft().behaviors[0]!
  expect(group.effects).toHaveLength(3)
  expect(group.targeting!.categories).toEqual(['ally', 'enemy'])
  expect('target' in group.effects[2]!.payload).toBe(false)
  expect(validateAbilityDefinition(e.draft())).toEqual([])
})

it('preserves an intentionally changed generated status as an independent authored tag', () => {
  const e = editor()
  e.change('Element', 'ice')
  e.change('Status ID', 'mark')
  const effects = e.draft().behaviors[0]!.effects
  expect(effects).toHaveLength(3)
  expect(effects[1]!.payload).toMatchObject({ statusId: 'mark' })
  expect(effects[2]!.payload).toMatchObject({ statusId: 'frozen' })
  e.change('Element', '')
  expect(e.draft().behaviors[0]!.effects).toHaveLength(2)
  expect(e.draft().behaviors[0]!.effects[1]!.payload).toMatchObject({ statusId: 'mark' })
})
