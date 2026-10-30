import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  parseAbilityDefinition,
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

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
import { AbilitySelect } from './ability-editor-fields'
import { SkillEffectEditor } from './skill-effect-editor'
import { defaultAbilityPayload } from './ability-effect-editor'
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
      'AbilityRequirementEditor',
      'SimpleAbilityRequirementEditor',
      'AbilityEffectEditor',
    ].includes(element.type.name)
  )
    return [element, ...controls((element.type as (props: unknown) => ReactElement)(element.props))]
  return [element, ...[element.props.children].flat(Infinity).flatMap(controls)]
}
function editor(group: AbilityBehavior) {
  let draft: AbilityDefinition = { schemaVersion: 1, behaviors: [group] }
  const tree = (section: 'details' | 'effects' = 'details') => (
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
    change(label: string, value: string) {
      const control = controls(tree()).find(
        (node) => node.type === AbilitySelect && node.props.label === label,
      )
      expect(control, label).toBeDefined()
      ;(control!.props.onChange as (value: string) => void)(value)
    },
  }
}
const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!

it.each(['circle', 'line', 'tile'] as const)(
  'offers an explicit first-tab unit Requirement aim from %s without altering saved effects',
  (shape) => {
    const group: AbilityBehavior = {
      ...base,
      requirementMode: 'simple',
      requirements: { kind: 'status-presence', subject: 'owner', statusId: 'burn', present: true },
      targeting: {
        ...base.targeting!,
        geometryVersion: 3,
        kind: shape === 'tile' ? 'ground-tile' : 'unit',
        teamPolicy: shape === 'tile' ? 'any' : 'enemy',
        categories: shape === 'tile' ? ['ground'] : ['enemy'],
        minimumRange: 0,
        maximumRange: 2,
        shape:
          shape === 'circle'
            ? { kind: 'circle', radius: 2 }
            : shape === 'line'
              ? { kind: 'line', length: 2 }
              : { kind: 'single' },
      },
      effects: [
        { id: 'self', payload: { type: 'healing', recipient: 'actor', target: 'self', amount: 1 } },
        {
          id: 'all',
          payload: { type: 'healing', recipient: 'affected-units', target: 'all', amount: 1 },
        },
      ],
    }
    expect(validateAbilityDefinition({ schemaVersion: 1, behaviors: [group] })).toEqual([])
    const e = editor(group)
    const before = structuredClone(e.draft())
    renderToStaticMarkup(e.tree())
    expect(e.draft()).toEqual(before)
    e.change('Requirement tag', 'wet')
    expect(e.draft().behaviors[0]!.targeting).toEqual(group.targeting)
    e.change('Target Requirement aim', 'enemy')
    const selected = e.draft().behaviors[0]!
    expect(selected.targeting).toEqual({
      ...group.targeting,
      kind: 'unit',
      teamPolicy: 'enemy',
      categories: ['enemy'],
      maximumSelections: 1,
      shape: { kind: 'single' },
    })
    expect(selected.requirements).toEqual({
      kind: 'status-presence',
      subject: 'selected',
      statusId: 'wet',
      present: true,
    })
    expect(selected.effects).toEqual(group.effects)
    expect(validateAbilityDefinition(e.draft())).toEqual([])
    const payload = controls(e.tree('effects')).find((node) => node.type === SkillEffectEditor)!
    ;(payload.props.onChange as (value: unknown) => void)({
      ...selected.effects[0]!.payload,
      amount: 7,
    })
    expect(e.draft().behaviors[0]!.targeting).toEqual(selected.targeting)
    expect(
      parseAbilityDefinition(JSON.parse(JSON.stringify(e.draft()))).behaviors[0]!.requirements,
    ).toEqual(selected.requirements)
  },
)

it('retains owner-turn limits without offering them for authoring and removes them explicitly', () => {
  const e = editor({ ...base, activationLimits: ['once-per-owner-turn', 'once-per-round'] })
  const html = renderToStaticMarkup(e.tree())
  expect(html).not.toContain('aria-label="Once per owner turn"')
  expect(html).toContain('Retained: once per owner turn')
  expect(e.draft().behaviors[0]!.activationLimits).toEqual([
    'once-per-owner-turn',
    'once-per-round',
  ])
  const remove = controls(e.tree()).find(
    (node) => node.type === 'button' && node.props.children === 'Remove retained owner-turn limit',
  )
  expect(remove).toBeDefined()
  ;(remove!.props.onClick as () => void)()
  expect(e.draft().behaviors[0]!.activationLimits).toEqual(['once-per-round'])
})

it('keeps a selected Enemy prerequisite independent of a later Ally effect edit', () => {
  const e = editor({
    ...base,
    requirementMode: 'simple',
    requirements: { kind: 'status-presence', subject: 'selected', statusId: 'burn', present: true },
    effects: [
      {
        id: 'benefit',
        payload: { type: 'healing', recipient: 'affected-units', target: 'ally', amount: 1 },
      },
    ],
  })
  const aim = e.draft().behaviors[0]!.targeting
  const payload = controls(e.tree('effects')).find((node) => node.type === SkillEffectEditor)!
  ;(payload.props.onChange as (value: unknown) => void)({
    ...e.draft().behaviors[0]!.effects[0]!.payload,
    amount: 7,
  })
  expect(e.draft().behaviors[0]!.targeting).toEqual(aim)
})

it('keeps tile-only effects and unavailable Target predicates blocked', () => {
  const group: AbilityBehavior = {
    ...base,
    requirementMode: 'simple',
    requirements: { kind: 'status-presence', subject: 'owner', statusId: 'burn', present: true },
    targeting: {
      ...base.targeting!,
      kind: 'empty-tile',
      teamPolicy: 'any',
      geometryVersion: 3,
      categories: ['ground'],
    },
    effects: [{ id: 'summon', payload: defaultAbilityPayload('summon') }],
  }
  expect(validateAbilityDefinition({ schemaVersion: 1, behaviors: [group] })).toEqual([])
  const e = editor(group)
  const html = renderToStaticMarkup(e.tree())
  expect(html).not.toContain('aria-label="Target Requirement aim"')
  const control = controls(e.tree()).find(
    (node) => node.type === AbilitySelect && node.props.label === 'Requirement target',
  )!
  ;(control.props.onChange as (value: string) => void)('selected')
  expect(e.draft().behaviors[0]).toEqual(group)
  expect(
    validateAbilityDefinition({
      schemaVersion: 1,
      behaviors: [{ ...group, requirements: { ...group.requirements!, subject: 'selected' } }],
    }),
  ).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'invalid-requirement' })]))
})

it('the explicitly authored Target gate rejects before costs and permits all effects only when that unit qualifies', () => {
  const e = editor({
    ...source().definition.behaviors[0]!,
    requirementMode: 'simple',
    classification: 'recovery',
    attackFamily: undefined,
    costs: [{ resource: 'mp', amount: 1 }],
    targeting: {
      ...base.targeting!,
      geometryVersion: 2,
      minimumRange: 0,
      maximumRange: 2,
      shape: { kind: 'circle', radius: 2 },
    },
    requirements: {
      kind: 'resource-state',
      subject: 'owner',
      resource: 'hp',
      comparison: 'less-than',
      basisPoints: 5000,
    },
    effects: [1, 2].map((amount) => ({
      id: `heal-${amount}`,
      payload: { type: 'healing', recipient: 'actor', target: 'self', amount },
    })),
  })
  e.change('Target Requirement aim', 'enemy')
  const saved = parseAbilityDefinition(JSON.parse(JSON.stringify(e.draft())))
  const root = captureCombatAbilitySource(
    source({ ...saved.behaviors[0]!, attackFamily: undefined }),
  )
  for (const enemyHp of [1000, 400]) {
    const initial = preparePv1fTurnEconomy(percentageDotEncounter())
    initial.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp = 600
    initial.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp = enemyHp
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
    expect(prepared.evaluation.legal).toBe(enemyHp === 400)
    if (enemyHp === 1000) {
      expect(prepared.evaluation.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'requirement-not-met' })]),
      )
      const before = structuredClone(state)
      expect(() => commitCombatAbilityCommand(input)).toThrow()
      expect(state).toEqual(before)
    } else {
      const result = commitCombatAbilityCommand(input)
      expect(result.events.filter((event) => event.event === 'healing_applied')).toHaveLength(2)
      expect(
        result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor'),
      ).toMatchObject({ hp: 603, mp: 19 })
      expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
        400,
      )
    }
  }
})

it.each(['skill', 'essence', 'resonance'] as const)(
  'authors and reloads the Target Requirement through the real %s editor wrapper',
  (kind) => {
    const ability: AbilityDefinition = {
      schemaVersion: 1,
      behaviors: [
        {
          ...base,
          requirementMode: 'simple',
          requirements: {
            kind: 'status-presence',
            subject: 'owner',
            statusId: 'burn',
            present: true,
          },
          targeting: {
            ...base.targeting!,
            minimumRange: 0,
            maximumRange: 2,
            shape: { kind: 'circle', radius: 2 },
          },
        },
      ],
    }
    const original =
      kind === 'skill'
        ? { ...resolveMatureSkillVersion('vanguard.forceful-strike')!, ability }
        : kind === 'resonance'
          ? { ...resolveResonanceForPair('wildwarden', 'edgedancer')!, ability }
          : {
              ...resolveEssenceForBuild('vanguard', null)!,
              skill: { ...resolveEssenceForBuild('vanguard', null)!.skill, ability },
            }
    let definition = original as unknown as CombatContentDefinition
    const tree = () => (
      <ContentDefinitionFields
        kind={kind}
        value={definition}
        tab="Parameters"
        abilitySection="details"
        onChange={(next) => {
          definition = next
        }}
      />
    )
    const control = controls(tree()).find(
      (node) => node.type === AbilitySelect && node.props.label === 'Target Requirement aim',
    )!
    expect(control).toBeDefined()
    ;(control.props.onChange as (value: string) => void)('enemy')
    definition = JSON.parse(JSON.stringify(definition)) as CombatContentDefinition
    const saved = (
      kind === 'essence'
        ? (definition.skill as CombatContentDefinition).ability
        : definition.ability
    ) as AbilityDefinition
    expect(saved.behaviors[0]!.requirements).toEqual({
      kind: 'status-presence',
      subject: 'selected',
      statusId: 'burn',
      present: true,
    })
    expect(saved.behaviors[0]!.targeting!.shape).toEqual({ kind: 'single' })
    expect(saved.behaviors[0]!.effects).toEqual(ability.behaviors[0]!.effects)
    expect(validateAbilityDefinition(saved)).toEqual([])
    const html = renderToStaticMarkup(tree())
    expect(html).toContain('<option value="selected" selected="">Target</option>')
    expect(html).not.toContain('aria-label="Once per owner turn"')
  },
)
