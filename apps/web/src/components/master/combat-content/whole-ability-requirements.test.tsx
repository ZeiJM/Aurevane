import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  parseAbilityDefinition,
  validateAbilityDefinition,
  type AbilityDefinition,
  type RequirementNode,
} from '@aurevane/game-core/combat/combat-definition'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { AbilitySelect } from './ability-editor-fields'
import { SkillEffectEditor } from './skill-effect-editor'
import { abilityBehaviorInformation } from '../../character/ability-detail-presentation'
import { percentageDotEncounter } from '../../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { source } from '../../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import {
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'

const wet: RequirementNode = {
  kind: 'status-presence',
  subject: 'owner',
  statusId: 'wet',
  present: true,
}
function ability(conditions: readonly (RequirementNode | null)[] = [wet, wet]): AbilityDefinition {
  return parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!,
        requirementMode: 'simple',
        requirements: null,
        effects: conditions.map((requirements, index) => ({
          id: `heal-${index}`,
          requirements,
          payload: { type: 'healing', recipient: 'actor', amount: index + 1 },
        })),
      },
    ],
  })
}
function controls(value: unknown): ReactElement<Record<string, unknown>>[] {
  if (!value || typeof value !== 'object' || !('props' in value)) return []
  const element = value as ReactElement<Record<string, unknown>>
  if (
    typeof element.type === 'function' &&
    [
      'AbilityDefinitionEditor',
      'AbilityGroupEditor',
      'LegacyEffectRequirements',
      'AbilityRequirementEditor',
      'SimpleAbilityRequirementEditor',
      'AbilityEffectEditor',
    ].includes(element.type.name)
  )
    return [element, ...controls((element.type as (props: unknown) => ReactElement)(element.props))]
  return [element, ...[element.props.children].flat(Infinity).flatMap(controls)]
}
function editor(initial: AbilityDefinition) {
  let draft = initial
  const tree = (section?: 'details' | 'effects') => (
    <AbilityDefinitionEditor
      value={draft}
      section={section}
      onChange={(next) => {
        draft = next
      }}
    />
  )
  return {
    draft: () => draft,
    tree,
    button(label: string) {
      return controls(tree('details')).find(
        (node) => node.type === 'button' && node.props.children === label,
      )!
    },
  }
}

it('authors requirements only in Details and applies the saved rule to the complete action', () => {
  const e = editor(ability([null, null]))
  expect(renderToStaticMarkup(e.tree('effects'))).not.toContain('aria-label="Requirement tag"')
  const select = controls(e.tree('details')).find(
    (node) => node.type === AbilitySelect && node.props.label === 'Requirement tag',
  )!
  ;(select.props.onChange as (value: string) => void)('wet')
  const saved = parseAbilityDefinition(JSON.parse(JSON.stringify(e.draft())))
  expect(saved.behaviors[0]!.requirements).toEqual(wet)
  expect(saved.behaviors[0]!.effects.map((effect) => effect.requirements)).toEqual([null, null])
  const report = abilityBehaviorInformation(saved.behaviors[0]!)
  expect(Object.fromEntries(report.rows).Requirements).toBe('Drenched [Self]')
  expect(
    report.effectDescriptions.every((description) => !description.includes('Applies only when')),
  ).toBe(true)
})

it('promotes matching compatible legacy conditions only after the explicit Details action', () => {
  const original = ability()
  const before = JSON.stringify(original)
  const e = editor(original)
  renderToStaticMarkup(e.tree('details'))
  renderToStaticMarkup(e.tree('effects'))
  expect(JSON.stringify(e.draft())).toBe(before)
  const button = e.button('Apply matching conditions to whole ability')
  expect(button).toBeDefined()
  expect(button.props.disabled).toBeFalsy()
  ;(button.props.onClick as () => void)()
  expect(e.draft().behaviors[0]!.requirements).toEqual(wet)
  expect(e.draft().behaviors[0]!.effects).toEqual(
    original.behaviors[0]!.effects.map(({ requirements: legacy, ...effect }) => {
      void legacy
      return effect
    }),
  )
  expect(validateAbilityDefinition(e.draft())).toEqual([])
  expect(JSON.stringify(original)).toBe(before)
})

it.each(['different effects', 'existing requirement', 'unavailable subject'])(
  'retains incompatible %s and permits explicit removal in Details',
  (conflict) => {
    let initial = ability()
    const group = initial.behaviors[0]!
    if (conflict === 'different effects') initial = ability([wet, { ...wet, statusId: 'burn' }])
    if (conflict === 'existing requirement')
      initial = {
        ...initial,
        behaviors: [{ ...group, requirements: { ...wet, statusId: 'burn' } }],
      }
    if (conflict === 'unavailable subject')
      initial = {
        ...initial,
        behaviors: [
          {
            ...group,
            targeting: { ...group.targeting!, shape: { kind: 'circle', radius: 1 } },
            effects: group.effects.map((effect) => ({
              ...effect,
              payload: { type: 'healing', recipient: 'affected-units', amount: 1 },
              requirements: { ...wet, subject: 'affected' as const },
            })),
          },
        ],
      }
    const e = editor(initial)
    const before = JSON.stringify(initial)
    const html = renderToStaticMarkup(e.tree('details'))
    expect(html).toContain('Retained effect conditions')
    expect(e.button('Apply matching conditions to whole ability').props.disabled).toBe(true)
    expect(JSON.stringify(e.draft())).toBe(before)
    ;(e.button('Remove all retained effect conditions').props.onClick as () => void)()
    expect(
      e.draft().behaviors[0]!.effects.every((effect) => effect.requirements === undefined),
    ).toBe(true)
    expect(e.draft().behaviors[0]!.requirements).toEqual(initial.behaviors[0]!.requirements)
  },
)

it.each<RequirementNode>([
  { ...wet, subject: 'affected' },
  { kind: 'all', children: [{ kind: 'any', children: [{ ...wet, subject: 'affected' }] }] },
  { kind: 'subject-relation', subject: 'owner', otherSubject: 'affected', relation: 'same-unit' },
])('blocks promotion of unavailable subjects in advanced legacy conditions: $kind', (condition) => {
  const original = ability([null])
  const { requirementMode: legacyMode, ...group } = original.behaviors[0]!
  void legacyMode
  const initial: AbilityDefinition = {
    ...original,
    behaviors: [
      {
        ...group,
        targeting: {
          ...group.targeting!,
          minimumRange: 0,
          maximumRange: 1,
          shape: { kind: 'circle', radius: 1 },
        },
        effects: [
          {
            id: 'heal',
            payload: { type: 'healing', recipient: 'affected-units', amount: 1 },
            requirements: condition,
          },
        ],
      },
    ],
  }
  expect(validateAbilityDefinition(initial)).toEqual([])
  const e = editor(initial)
  const button = e.button('Apply matching conditions to whole ability')
  expect(button.props.disabled).toBe(true)
  ;(button.props.onClick as () => void)()
  expect(e.draft()).toEqual(initial)
  ;(e.button('Remove all retained effect conditions').props.onClick as () => void)()
  expect(e.draft().behaviors[0]!.effects[0]!.requirements).toBeUndefined()
  expect(e.draft().behaviors[0]!.requirements).toBeNull()
})

it('retains saved effect subjects through unrelated payload and activation edits', () => {
  const initial = ability([{ ...wet, subject: 'selected' }])
  const group = initial.behaviors[0]!
  const e = editor({
    ...initial,
    behaviors: [
      { ...group, targeting: { ...group.targeting!, shape: { kind: 'circle', radius: 1 } } },
    ],
  })
  const payload = controls(e.tree('effects')).find((node) => node.type === SkillEffectEditor)!
  expect(payload).toBeDefined()
  ;(payload.props.onChange as (value: unknown) => void)({
    ...group.effects[0]!.payload,
    amount: 12,
  })
  expect(e.draft().behaviors[0]!.effects[0]!.requirements).toEqual({ ...wet, subject: 'selected' })
  const activation = controls(e.tree('details')).find(
    (node) => node.type === AbilitySelect && node.props.label === 'Group activation',
  )!
  ;(activation.props.onChange as (value: string) => void)('manual')
  expect(e.draft().behaviors[0]!.effects[0]!.requirements).toEqual({ ...wet, subject: 'selected' })
})

it('promoted Details requirements reject the whole command before costs and allow every effect when met', () => {
  const lowHp: RequirementNode = {
    kind: 'resource-state',
    subject: 'owner',
    resource: 'hp',
    comparison: 'less-than',
    basisPoints: 5000,
  }
  const e = editor(ability([lowHp, lowHp]))
  ;(e.button('Apply matching conditions to whole ability').props.onClick as () => void)()
  const saved = parseAbilityDefinition(JSON.parse(JSON.stringify(e.draft())))
  const root = captureCombatAbilitySource(
    source({
      ...saved.behaviors[0]!,
      classification: 'recovery',
      attackFamily: undefined,
      costs: [{ resource: 'mp', amount: 1 }],
    }),
  )
  for (const hp of [1000, 400]) {
    const initial = preparePv1fTurnEconomy(percentageDotEncounter())
    initial.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp = hp
    const state = reconcileCombatAbilitySources(initial, [root])
    const input = {
      state,
      actorId: 'actor',
      root: { kind: 'canonical' as const, source: root },
      selection: { kind: 'unit' as const, combatantId: 'enemy' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, root),
      manualModifiers: [],
    }
    const prepared = prepareCombatAbilityCommand(input)
    expect(prepared.evaluation.legal).toBe(hp === 400)
    if (hp === 1000) {
      expect(prepared.evaluation.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'requirement-not-met' })]),
      )
      expect(() => commitCombatAbilityCommand(input)).toThrow()
      expect(state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.mp).toBe(20)
      expect(state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp).toBe(1000)
    } else {
      const result = commitCombatAbilityCommand(input)
      expect(result.events.filter((event) => event.event === 'healing_applied')).toHaveLength(2)
      expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.mp).toBe(
        19,
      )
      expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp).toBe(
        403,
      )
    }
  }
})
