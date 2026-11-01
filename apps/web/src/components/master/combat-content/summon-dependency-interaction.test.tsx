import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import type {
  SummonAbilityDefinition,
  SummonProfileDefinition,
} from '@aurevane/game-core/combat/summon-content'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { SummonProfileEditor } from './summon-profile-editor'
import { AbilityNumber } from './ability-editor-fields'
import { validateSkillDefinition } from '@/server/master/combat-content-authoring-validation'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'

vi.mock('server-only', () => ({}))

// Walk the real controls and callbacks. These editors only need local, synchronous hooks here.
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
  useState: (initial: unknown) => [initial, () => {}],
  useId: () => ':summon-dependency:',
}))

type Props = Record<string, unknown> & { children?: ReactNode }
function controls(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(controls)
  if (!isValidElement<Props>(node)) return []
  if (
    typeof node.type === 'function' &&
    ['SkillEffectListEditor', 'SkillEffectEditor', 'EffectTargetEditor'].includes(node.type.name)
  )
    return [node, ...controls((node.type as (props: Props) => ReactNode)(node.props))]
  return [node, ...controls(node.props.children)]
}
function editor(
  effects: readonly CombatEffectDefinition[],
  ability: Partial<SummonAbilityDefinition> = {},
) {
  const original = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
  let value: SummonProfileDefinition = {
    ...original,
    abilities: [
      {
        ...original.abilities[0]!,
        target: {
          ...original.abilities[0]!.target,
          geometryVersion: 3,
          categories: ['enemy'],
          maximumSelections: 1,
        },
        requirements: [{ kind: 'actor-status-present', statusId: 'inspired' }],
        description: 'Keep the authored Skill notes.',
        battleText: '{actor} uses {ability}.',
        effects,
        ...ability,
      },
    ],
  }
  const captured = structuredClone(value)
  const tree = () => SummonProfileEditor({ value, onChange: (next) => (value = next) })
  const nodes = () => controls(tree())
  return {
    value: () => value,
    captured,
    change(label: string, next: string, index = 0) {
      const field = nodes().filter(
        (node) =>
          node.props['aria-label'] === label ||
          (node.type === AbilityNumber && node.props.label === label),
      )[index]
      expect(field, label).toBeDefined()
      if (field!.type === AbilityNumber)
        (field!.props.onChange as (value: number) => void)(Number(next))
      else (field!.props.onChange as (event: unknown) => void)({ currentTarget: { value: next } })
    },
    clickEffect(index: number, label: string) {
      const row = nodes().filter((node) => node.type === 'article')[index + 1]!
      const button = controls(row).find(
        (node) => node.type === 'button' && node.props.children === label,
      )!
      expect(button, label).toBeDefined()
      ;(button.props.onClick as () => void)()
    },
    reload() {
      value = JSON.parse(JSON.stringify(value)) as SummonProfileDefinition
    },
  }
}
const damage = {
  type: 'damage',
  recipient: 'primary-unit',
  target: 'enemy',
  amount: 5,
  durationTurns: 0,
  authoringLink: 'authored.hit',
} as const

it.each(['ice', 'water', 'storm', 'fire'] as const)(
  'accepts the edited %s Summon through strict save and canonical capture',
  (element) => {
    const native = resolveMatureSkillVersion('wildwarden.renewing-herbs')!
    const e = editor([{ type: 'damage', recipient: 'primary-unit', target: 'enemy', amount: 5 }])
    e.change('Element', element)
    const profile = e.value()
    expect(validateSkillDefinition({ ...native, summonProfile: profile }).issues).toEqual([])
    const ability: AbilityDefinition = {
      schemaVersion: 1,
      behaviors: [
        {
          ...defaultBasicSkills().find((row) => row.id === 'basic.guard')!.ability.behaviors[0]!,
          id: 'call',
          classification: 'utility',
          targeting: { ...native.target, geometryVersion: 3, maximumSelections: 1 },
          effects: [
            { id: 'spawn', payload: { type: 'summon', recipient: 'selected-tile', profile } },
          ],
        },
      ],
    }
    expect(validateSkillDefinition({ ...native, ability }).issues).toEqual([])
    const captured = captureCombatAbilitySource({
      schemaVersion: 1,
      sourceInstanceId: 'skill.native-elemental-summon',
      ownerCombatantId: 'actor',
      abilityId: native.id,
      contentVersion: native.contentVersion,
      sourceKind: 'discipline-skill',
      sourceDisciplineId: native.sourceDisciplineId,
      tags: native.tags,
      definition: ability,
    })
    const payload = captured.definition.behaviors[0]!.effects[0]!.payload
    if (payload.type !== 'summon') throw new Error('Expected captured Summon.')
    expect(payload.profile).toEqual(profile)
    expect(payload.profile.abilities[0]!.effects[1]!.authoringLink).toMatch(/^element-companion\./)
    e.change('Element', '')
    expect(payload.profile.abilities[0]!.effects).toHaveLength(2)
    expect(e.value().abilities[0]!.effects).toHaveLength(1)
  },
)

it.each([
  ['ice', { type: 'apply-status', statusId: 'frozen', recipient: 'primary-unit', target: 'enemy' }],
  ['water', { type: 'apply-status', statusId: 'wet', recipient: 'primary-unit', target: 'enemy' }],
  [
    'storm',
    { type: 'apply-status', statusId: 'conductive', recipient: 'primary-unit', target: 'enemy' },
  ],
  [
    'fire',
    {
      type: 'remove-status',
      statusIds: ['frozen'],
      recipient: 'actor',
      target: 'self',
      removalMode: 'specified',
    },
  ],
] as const)(
  'links %s from the native Summon Element control and retains it through reloads',
  (element, expected) => {
    const e = editor([damage])
    e.change('Element', element)
    expect(e.value().abilities[0]!.effects).toHaveLength(2)
    expect(e.value().abilities[0]!.effects[0]).toEqual({ ...damage, element })
    expect(e.value().abilities[0]!.effects[1]).toMatchObject(expected)
    const linked = e.value().abilities[0]!.effects[1]!.authoringLink
    expect(linked).toMatch(/^element-companion\./)
    e.reload()
    e.change('Damage amount', '6')
    e.change('Element', element)
    expect(e.value().abilities[0]!.effects).toHaveLength(2)
    expect(e.value().abilities[0]!.effects[1]!.authoringLink).toBe(linked)
    expect(e.value().abilities[0]!.target).toEqual(e.captured.abilities[0]!.target)
    expect(e.value().abilities[0]!.requirements).toEqual(e.captured.abilities[0]!.requirements)
    expect(e.value().abilities[0]!.id).toBe(e.captured.abilities[0]!.id)
    expect(e.value().abilities[0]!.description).toBe('Keep the authored Skill notes.')
    expect(e.value().abilities[0]!.battleText).toBe('{actor} uses {ability}.')
  },
)

it('changes and clears generated companions while retaining independent standard statuses and row order', () => {
  const chilled = {
    type: 'apply-status',
    recipient: 'primary-unit',
    target: 'enemy',
    statusId: 'frozen',
    stacks: 1,
    durationTurns: 2,
  } as const
  const guard = {
    type: 'apply-status',
    recipient: 'actor',
    statusId: 'guarded',
    stacks: 1,
    durationTurns: 7,
    authoringLink: 'authored.guard',
  } as const
  const e = editor([guard, damage, chilled])
  e.change('Element', 'ice')
  expect(e.value().abilities[0]!.effects).toEqual([guard, { ...damage, element: 'ice' }, chilled])
  e.change('Element', 'water')
  expect(e.value().abilities[0]!.effects.slice(0, 3)).toEqual([
    guard,
    { ...damage, element: 'water' },
    chilled,
  ])
  expect(e.value().abilities[0]!.effects[3]).toMatchObject({ statusId: 'wet' })
  e.change('Element', 'storm')
  expect(e.value().abilities[0]!.effects).toHaveLength(4)
  expect(e.value().abilities[0]!.effects[3]).toMatchObject({ statusId: 'conductive' })
  e.change('Element', '')
  expect(e.value().abilities[0]!.effects).toEqual([guard, damage, chilled])
})

it('keeps an edited generated companion and relinks a deleted requirement without duplicate packets', () => {
  const e = editor([damage])
  e.change('Element', 'water')
  e.change('Effect duration (turns)', '9')
  e.reload()
  e.change('Damage amount', '7')
  expect(e.value().abilities[0]!.effects[1]).toMatchObject({ statusId: 'wet', durationTurns: 9 })
  e.clickEffect(1, 'Remove')
  expect(e.value().abilities[0]!.effects).toHaveLength(2)
  expect(e.value().abilities[0]!.effects[1]).toMatchObject({ statusId: 'wet' })
  e.clickEffect(0, 'Remove')
  expect(e.value().abilities[0]!.effects).toEqual([])
})

it('keeps Ground references and timing when an unlinked damage edit adds a companion', () => {
  const groundArea = {
    durationRounds: 7,
    timing: 'delayed',
    entryEffectOrdinals: [0],
    visualPresetId: 'frost',
  } as const
  const e = editor([{ type: 'damage', recipient: 'affected-units', target: 'ground', amount: 5 }], {
    target: {
      kind: 'ground-tile',
      geometryVersion: 3,
      categories: ['ground'],
      teamPolicy: 'any',
      friendlyFire: 'all-units',
      minimumRange: 0,
      maximumRange: 5,
      maximumSelections: 1,
      shape: { kind: 'single' },
      maximumElevationDifference: 0,
      requiresLineOfSight: true,
    },
    groundArea,
  })
  e.change('Element', 'ice')
  expect(e.value().abilities[0]!.effects[1]).toMatchObject({
    statusId: 'frozen',
    recipient: 'affected-units',
    target: 'ground',
  })
  expect(e.value().abilities[0]!.groundArea).toEqual(groundArea)
})

it('updates the linked target while retaining edited duration and generated identity', () => {
  const e = editor([{ ...damage, recipient: 'affected-units' }])
  e.change('Element', 'ice')
  const link = e.value().abilities[0]!.effects[1]!.authoringLink
  e.change('Effect duration (turns)', '8')
  e.change('Target', 'all')
  expect(e.value().abilities[0]!.effects).toHaveLength(2)
  expect(e.value().abilities[0]!.effects[1]).toMatchObject({
    statusId: 'frozen',
    target: 'all',
    durationTurns: 8,
    authoringLink: link,
  })
})

it('preserves a repurposed generated row while repairing its former companion', () => {
  const repurposed = {
    type: 'apply-status',
    recipient: 'primary-unit',
    target: 'enemy',
    statusId: 'mark',
    stacks: 1,
    durationTurns: 8,
    authoringLink: 'element-companion.frozen.primary-unit',
  } as const
  const e = editor([{ ...damage, element: 'ice' }, repurposed])
  e.change('Damage amount', '7')
  expect(e.value().abilities[0]!.effects).toHaveLength(3)
  expect(e.value().abilities[0]!.effects[1]).toEqual(repurposed)
  expect(e.value().abilities[0]!.effects[2]).toMatchObject({
    statusId: 'frozen',
    authoringLink: 'element-companion.frozen.primary-unit.1',
  })
  e.change('Element', '')
  expect(e.value().abilities[0]!.effects).toHaveLength(2)
  expect(e.value().abilities[0]!.effects[1]).toEqual(repurposed)
})

it('shares one companion across repeated elemental packets and keeps authored packet order', () => {
  const second = { ...damage, amount: 3, authoringLink: 'authored.second-hit' }
  const e = editor([damage, second])
  e.change('Element', 'ice', 0)
  const link = e.value().abilities[0]!.effects[2]!.authoringLink
  e.change('Element', 'ice', 1)
  expect(e.value().abilities[0]!.effects).toHaveLength(3)
  expect(e.value().abilities[0]!.effects.slice(0, 2)).toEqual([
    { ...damage, element: 'ice' },
    { ...second, element: 'ice' },
  ])
  expect(e.value().abilities[0]!.effects[2]!.authoringLink).toBe(link)
})
