import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import type { SummonProfileDefinition } from '@aurevane/game-core/combat/summon-content'
import type { CombatContentDefinition } from '@aurevane/db/combat-content'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { SummonProfileEditor } from './summon-profile-editor'
import { ContentDefinitionFields } from './content-definition-fields'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useId: () => ':ground:',
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
  useState: (initial: unknown) => [initial, () => {}],
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))

type Props = Record<string, unknown> & { children?: ReactNode }
const expand = new Set([
  'AbilityGroupEditor',
  'AbilityEffectEditor',
  'SkillEffectListEditor',
  'SkillEffectEditor',
  'EffectTargetEditor',
  'SkillMechanics',
  'AbilityGroundEditor',
  'SkillGroundEditor',
])
function controls(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(controls)
  if (!isValidElement<Props>(node)) return []
  return [
    node,
    ...(typeof node.type === 'function' && expand.has(node.type.name)
      ? controls((node.type as (props: Props) => ReactNode)(node.props))
      : controls(node.props.children)),
  ]
}
function changeTarget(tree: ReactNode, target: string) {
  const field = controls(tree).find(
    (node) => node.type === 'select' && node.props['aria-label'] === 'Target',
  )!
  expect(field).toBeDefined()
  ;(field.props.onChange as (event: unknown) => void)({ currentTarget: { value: target } })
}
function changeGroundSetting(tree: ReactNode, label: string, value: string) {
  const field = controls(tree).find((node) => node.props['aria-label'] === label)!
  expect(field, label).toBeDefined()
  ;(field.props.onChange as (event: unknown) => void)({ currentTarget: { value } })
}
const hit = {
  type: 'damage' as const,
  recipient: 'affected-units' as const,
  target: 'enemy' as const,
  amount: 5,
}
const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!

it('creates and removes the canonical field through the actual effect target selector', () => {
  let value: AbilityDefinition = {
    schemaVersion: 1,
    behaviors: [{ ...base, effects: [{ id: 'hit', payload: hit }] }],
  }
  const original = structuredClone(value)
  const tree = () =>
    AbilityDefinitionEditor({
      value,
      section: 'effects',
      onChange: (next) => {
        value = next
      },
    })
  changeTarget(tree(), 'ground')
  expect(value.behaviors[0]!.groundArea).toMatchObject({
    durationRounds: 2,
    visualPresetId: 'arcane-pulse',
    placementTimingVersion: 1,
    entryEffectIds: ['hit'],
  })
  const effects = renderToStaticMarkup(
    createElement(AbilityDefinitionEditor, { value, section: 'effects', onChange: vi.fn() }),
  )
  const range = renderToStaticMarkup(
    createElement(AbilityDefinitionEditor, { value, section: 'range', onChange: vi.fn() }),
  )
  expect(effects.match(/aria-label="Ground affects"/g)).toHaveLength(1)
  expect(range).not.toContain('aria-label="Ground affects"')
  changeGroundSetting(tree(), 'Ground affects', 'self')
  changeGroundSetting(tree(), 'Ground duration (rounds)', '7')
  changeGroundSetting(tree(), 'Ground animation', 'poison')
  expect(value.behaviors[0]!.groundArea).toMatchObject({
    targetTeams: 'self',
    durationRounds: 7,
    visualPresetId: 'poison',
    entryEffectIds: ['hit'],
    placementTimingVersion: 1,
  })
  changeTarget(tree(), 'enemy')
  expect(value.behaviors[0]).not.toHaveProperty('groundArea')
  expect(original.behaviors[0]).not.toHaveProperty('groundArea')
})

it('creates native Summon Ground persistence through the same target selector and keeps settings in Effects', () => {
  const source = resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!
  let value: SummonProfileDefinition = {
    ...source,
    abilities: [{ ...source.abilities[0]!, effects: [hit] }],
  }
  const tree = () =>
    SummonProfileEditor({
      value,
      onChange: (next) => {
        value = next
      },
    })
  changeTarget(tree(), 'ground')
  expect(value.abilities[0]!.groundArea).toMatchObject({
    durationRounds: 2,
    placementTimingVersion: 1,
    entryEffectOrdinals: [0],
  })
  const html = renderToStaticMarkup(
    createElement(SummonProfileEditor, { value, onChange: vi.fn() }),
  )
  const effects = html.slice(
    html.indexOf('<summary>Effects</summary>'),
    html.indexOf('<summary>Range &amp; Area</summary>'),
  )
  expect(effects).toContain('aria-label="Ground animation"')
  changeGroundSetting(tree(), 'Ground affects', 'allies')
  changeGroundSetting(tree(), 'Ground duration (rounds)', '8')
  changeGroundSetting(tree(), 'Ground animation', 'frost')
  expect(value.abilities[0]!.groundArea).toMatchObject({
    targetTeams: 'allies',
    durationRounds: 8,
    visualPresetId: 'frost',
    entryEffectOrdinals: [0],
    placementTimingVersion: 1,
  })
  changeTarget(tree(), 'enemy')
  expect(value.abilities[0]).not.toHaveProperty('groundArea')
})

it.each(['skill', 'essence'] as const)(
  'creates legacy %s persistence on target selection and mounts its shared profile only in Effects',
  (kind) => {
    const source = resolveMatureSkillVersion('vanguard.forceful-strike')!
    let value = { ...source, effects: [hit] }
    const definition = () =>
      (kind === 'skill'
        ? value
        : {
            ...resolveEssenceForBuild('vanguard', null)!,
            skill: value,
          }) as unknown as CombatContentDefinition
    const tree = () =>
      ContentDefinitionFields({
        kind,
        value: definition(),
        tab: 'Parameters',
        abilitySection: 'effects',
        onChange: (next) => {
          value = (kind === 'skill' ? next : next.skill) as unknown as typeof value
        },
      })
    changeTarget(tree(), 'ground')
    expect(value.groundArea).toMatchObject({
      durationRounds: 2,
      placementTimingVersion: 1,
      entryEffectOrdinals: [0],
    })
    const render = (abilitySection: 'effects' | 'range') =>
      renderToStaticMarkup(
        createElement(ContentDefinitionFields, {
          kind,
          value: definition(),
          tab: 'Parameters',
          abilitySection,
          onChange: vi.fn(),
        }),
      )
    expect(render('effects')).toContain('aria-label="Ground animation"')
    expect(render('range')).not.toContain('aria-label="Ground animation"')
    changeGroundSetting(tree(), 'Ground affects', 'allies')
    changeGroundSetting(tree(), 'Ground duration (rounds)', '8')
    changeGroundSetting(tree(), 'Ground animation', 'frost')
    expect(value.groundArea).toMatchObject({
      targetTeams: 'allies',
      durationRounds: 8,
      visualPresetId: 'frost',
      entryEffectOrdinals: [0],
      placementTimingVersion: 1,
    })
    changeTarget(tree(), 'enemy')
    expect(value).not.toHaveProperty('groundArea')
    expect(value.authoring.validationTags).not.toContain('persistent-ground-areas')
  },
)
