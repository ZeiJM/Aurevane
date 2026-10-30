import { isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { withAuthoredAreaRecipients } from '@aurevane/game-core/combat/combat-effect-target-authoring'
import {
  validateSkillDefinition,
  validateEssenceAuthoringDefinition,
  validateResonanceAuthoringDefinition,
} from '@/server/master/combat-content-authoring-validation'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { AbilityTargetingEditor } from './ability-targeting-editor'
import { readMechanicsBody, writeMechanicsBody } from './essence-editor-mechanics'
import { upgradeSkillFormat } from './skill-format-upgrade'
import type { CombatContentDefinition } from '@aurevane/db/combat-content'
import { ContentDefinitionFields } from './content-definition-fields'
import { SkillTargetingEditor } from './skill-targeting-editor'
import { EffectTagPicker } from './effect-tag-picker'
import { AbilityCostEditor } from './ability-cost-editor'
import { AbilitySelect } from './ability-editor-fields'
import { combatContentCategory } from '@/server/combat/combat-content-categories'
import { AreaRecipientRepair } from './area-recipient-repair'

function elements(node: ReactNode): { type: unknown; props: Record<string, unknown> }[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<{ children?: ReactNode }>(node)) return []
  return [{ type: node.type, props: node.props }, ...elements(node.props.children)]
}
const source = () => structuredClone(resolveMatureSkillVersion('vanguard.forceful-strike')!)
const area = {
  geometryVersion: 2 as const,
  shape: { kind: 'line' as const, length: 1 },
  minimumRange: 0,
  maximumRange: 1,
  maximumSelections: 1,
}

it('reproduces native Essence rejection and exposes its specific nested area issue', () => {
  const original = structuredClone(resolveEssenceForBuild('vanguard', null)!)
  const essence = {
    ...original,
    skill: { ...original.skill, target: { ...original.skill.target, ...area } },
  }
  const result = validateEssenceAuthoringDefinition(essence)
  expect(result.valid).toBe(false)
  expect(result.issues.some((issue) => issue.path === 'skill.definition')).toBe(true)
  expect(
    result.issues.some(
      (issue) =>
        issue.path.startsWith('skill.') && issue.message.includes('unspecified primary unit'),
    ),
  ).toBe(true)
  expect(() => combatContentCategory('essence')!.parseAuthoring(essence)).toThrow(
    /unspecified primary unit/,
  )
})

it('explicit native area repair preserves Essence envelope, PvP overrides, and all payment amounts', () => {
  const original = structuredClone(resolveEssenceForBuild('vanguard', null)!)
  const essence = {
    ...original,
    skill: {
      ...original.skill,
      target: { ...original.skill.target, ...area },
      overrides: { pvp: { apCost: 60, cooldownOwnerTurns: 3 } },
    },
  }
  const body = readMechanicsBody('essence', essence as unknown as CombatContentDefinition)
  const skill = essence.skill
  const repaired = writeMechanicsBody('essence', essence as unknown as CombatContentDefinition, {
    ...body,
    effects: withAuthoredAreaRecipients(skill.target, skill.effects),
  })
  expect(validateEssenceAuthoringDefinition(repaired)).toMatchObject({ valid: true, issues: [] })
  expect(repaired.skill).toMatchObject({
    apCost: skill.apCost,
    cooldown: skill.cooldown,
    overrides: skill.overrides,
  })
  expect(essence.skill.effects[0]!.recipient).toBe('primary-unit')
})

it('authors area recipients from the canonical geometry control and passes Skill, Essence and Resonance validation', () => {
  const skill = upgradeSkillFormat(source(), 'base')
  let ability = skill.ability!
  const tree = AbilityDefinitionEditor({
    value: ability,
    section: 'range',
    onChange: (next) => {
      ability = next
    },
  })
  const group = elements(tree).find(
    (entry) =>
      typeof entry.type === 'function' && 'value' in entry.props && 'section' in entry.props,
  )!
  const rendered = (group.type as (props: unknown) => ReactNode)(group.props)
  const target = elements(rendered).find((entry) => entry.type === AbilityTargetingEditor)!
  ;(target.props.onChange as (next: object) => void)({ ...skill.target, ...area })
  expect(ability.behaviors[0]!.effects[0]!.payload.recipient).toBe('affected-units')
  expect(validateSkillDefinition({ ...skill, ability })).toMatchObject({ valid: true })
  const essence = resolveEssenceForBuild('vanguard', null)!
  expect(validateEssenceAuthoringDefinition({ ...essence, ability })).toMatchObject({ valid: true })
  const resonance = resolveResonanceForPair('lifebinder', 'vanguard')!
  expect(validateResonanceAuthoringDefinition({ ...resonance, ability })).toMatchObject({
    valid: true,
  })
  expect(skill.ability!.behaviors[0]!.effects[0]!.payload.recipient).toBe('primary-unit')
})

it('offers deliberate repair for invalid ordinary area recipients and keeps selected Conditions intact', () => {
  const skill = source()
  const target = { ...skill.target, ...area }
  let effects = skill.effects
  const props = {
    target,
    effects,
    onChange: (next: typeof effects) => {
      effects = next
    },
  }
  const tree = AreaRecipientRepair(props)
  expect(renderToStaticMarkup(tree)).toContain('Use area recipients')
  expect(effects[0]!.recipient).toBe('primary-unit')
  const button = elements(tree).find((entry) => entry.type === 'button')!
  ;(button.props.onClick as () => void)()
  expect(effects[0]!.recipient).toBe('affected-units')
  expect(AreaRecipientRepair({ ...props, requiresSelectedUnit: true })).toBeNull()
  const canonical = upgradeSkillFormat(skill, 'base').ability!
  const behavior = {
    ...canonical.behaviors[0]!,
    targeting: target,
    requirements: {
      kind: 'status-presence' as const,
      subject: 'selected' as const,
      statusId: 'wet',
      present: true,
    },
  }
  expect(() => parseAbilityDefinition({ ...canonical, behaviors: [behavior] })).toThrow()
})

it('applies native Essence geometry changes through the actual shared fields without resetting context costs', () => {
  const original = structuredClone(resolveEssenceForBuild('vanguard', null)!)
  const source = {
    ...original,
    skill: { ...original.skill, overrides: { pvp: { apCost: 60, cooldownOwnerTurns: 3 } } },
  }
  let result = source as unknown as CombatContentDefinition
  const fields = ContentDefinitionFields({
    kind: 'essence',
    value: result,
    tab: 'Parameters',
    abilitySection: 'range',
    onChange: (next) => {
      result = next
    },
  })
  const mechanics = elements(fields).find(
    (entry) =>
      typeof entry.type === 'function' &&
      (entry.type as { name: string }).name === 'SkillMechanics',
  )!
  const rendered = (mechanics.type as (props: unknown) => ReactNode)(mechanics.props)
  const targeting = elements(rendered).find((entry) => entry.type === SkillTargetingEditor)!
  ;(targeting.props.onChange as (next: object) => void)({ ...source.skill.target, ...area })
  expect(validateEssenceAuthoringDefinition(result)).toMatchObject({ valid: true })
  expect(result.skill).toMatchObject({
    overrides: source.skill.overrides,
    apCost: source.skill.apCost,
    cooldown: source.skill.cooldown,
  })
  expect(source.skill.effects[0]!.recipient).toBe('primary-unit')
})

it('binds a newly added canonical damage effect to an existing area while unrelated edits preserve drafts', () => {
  const skill = upgradeSkillFormat(source(), 'base')
  const base = skill.ability!.behaviors[0]!
  const invalid = {
    ...skill.ability!,
    behaviors: [{ ...base, targeting: { ...base.targeting!, ...area } }],
  }
  let result = invalid
  const renderGroup = (section: 'effects' | 'economy' | 'accuracy') => {
    const tree = AbilityDefinitionEditor({
      value: invalid,
      section,
      onChange: (next) => {
        result = next as typeof invalid
      },
    })
    const group = elements(tree).find(
      (entry) => typeof entry.type === 'function' && 'section' in entry.props,
    )!
    return (group.type as (props: unknown) => ReactNode)(group.props)
  }
  const costs = elements(renderGroup('economy')).find((entry) => entry.type === AbilityCostEditor)!
  ;(costs.props.onChange as (costs: unknown[]) => void)([{ resource: 'ap', amount: 59 }])
  expect(result.behaviors[0]!.effects).toBe(invalid.behaviors[0]!.effects)
  const accuracy = elements(renderGroup('accuracy')).find((entry) => entry.type === AbilitySelect)!
  ;(accuracy.props.onChange as (kind: string) => void)('always')
  expect(result.behaviors[0]!.effects).toBe(invalid.behaviors[0]!.effects)
  const picker = elements(renderGroup('effects')).find((entry) => entry.type === EffectTagPicker)!
  ;(picker.props.onAdd as (payload: object) => void)({
    type: 'damage',
    recipient: 'primary-unit',
    amount: 2,
  })
  expect(result.behaviors[0]!.effects.at(-1)!.payload.recipient).toBe('affected-units')
  expect(result.behaviors[0]!.effects[0]!.payload.recipient).toBe('primary-unit')
})

it('offers explicit unit Requirement targeting while retaining the prerequisite tag and effects', () => {
  const skill = upgradeSkillFormat(source(), 'base')
  const base = skill.ability!.behaviors[0]!
  const requirements = {
    kind: 'status-presence' as const,
    subject: 'owner' as const,
    statusId: 'invisible',
    present: true,
  }
  let ability = {
    ...skill.ability!,
    behaviors: [{ ...base, targeting: { ...base.targeting!, ...area }, requirements }],
  }
  const tree = AbilityDefinitionEditor({
    value: ability,
    section: 'details',
    onChange: (next) => {
      ability = next as typeof ability
    },
  })
  expect(renderToStaticMarkup(tree)).toContain('whole-ability Requirement')
  const group = elements(tree).find(
    (entry) => typeof entry.type === 'function' && 'section' in entry.props,
  )!
  const rendered = (group.type as (props: unknown) => ReactNode)(group.props)
  const aim = elements(rendered).find(
    (entry) => entry.type === AbilitySelect && entry.props.label === 'Target Requirement aim',
  )!
  expect(aim).toBeDefined()
  expect(ability.behaviors[0]!.requirements).toBe(requirements)
  const effects = ability.behaviors[0]!.effects
  ;(aim.props.onChange as (policy: string) => void)('enemy')
  expect(ability.behaviors[0]!.targeting!.shape).toEqual({ kind: 'single' })
  expect(ability.behaviors[0]!.requirements).toEqual({ ...requirements, subject: 'selected' })
  expect(requirements.subject).toBe('owner')
  expect(ability.behaviors[0]!.effects).toEqual(effects)
  expect(() => parseAbilityDefinition(ability)).not.toThrow()
  const html = renderToStaticMarkup(
    <AbilityDefinitionEditor value={ability} section="details" onChange={() => {}} />,
  )
  expect(html).toContain('>Target</option>')
})

it.each(['skill', 'resonance'] as const)(
  'retains authoritative rejection and exposes the actual canonical %s save issue',
  (kind) => {
    const skill = upgradeSkillFormat(source(), 'base')
    const ability = {
      ...skill.ability!,
      behaviors: skill.ability!.behaviors.map((behavior) => ({
        ...behavior,
        targeting: { ...behavior.targeting!, ...area },
      })),
    }
    const definition =
      kind === 'skill'
        ? { ...skill, ability }
        : { ...resolveResonanceForPair('lifebinder', 'vanguard')!, ability }
    expect(() => combatContentCategory(kind)!.parseAuthoring(definition)).toThrow(
      /unspecified primary unit/,
    )
  },
)

it('uses plain visible behavior labels while retaining serialized choices and untouched mechanics', () => {
  const skill = upgradeSkillFormat(source(), 'base')
  let ability = skill.ability!
  const before = JSON.stringify(ability)
  const tree = AbilityDefinitionEditor({
    value: ability,
    onChange: (next) => {
      ability = next
    },
  })
  const html = renderToStaticMarkup(tree)
  for (const label of [
    'Activation',
    'Ability type',
    'Purpose',
    'Damage type',
    'New effect',
    'Add new effect',
  ])
    expect(html).toContain(label)
  expect(html).not.toContain('>Group activation</span>')
  expect(html).toContain('Behavior 1 · Manual action')
  expect(html).toContain('<option value="recovery">Recovery</option>')
  expect(JSON.stringify(ability)).toBe(before)
  const group = elements(tree).find(
    (entry) => typeof entry.type === 'function' && 'section' in entry.props,
  )!
  const rendered = (group.type as (props: unknown) => ReactNode)(group.props)
  const purpose = elements(rendered).find(
    (entry) => entry.type === AbilitySelect && entry.props.label === 'Group classification',
  )!
  ;(purpose.props.onChange as (choice: string) => void)('recovery')
  expect(ability.behaviors[0]!.classification).toBe('recovery')
  expect(ability.behaviors[0]!.costs).toEqual(skill.ability!.behaviors[0]!.costs)
  expect(ability.behaviors[0]!.effects).toEqual(skill.ability!.behaviors[0]!.effects)
})
