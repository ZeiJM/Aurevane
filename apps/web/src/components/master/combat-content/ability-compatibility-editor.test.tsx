import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { AbilityDefinitionEditor, withSharedEffectAim } from './ability-definition-editor'
import { activeAbilityForAuthoring } from '@/lib/combat-ability-authoring-compatibility'
import { correctCombatContentEntries } from '@/lib/combat-content-corrector'
import { recordIsDirty } from './content-record-workflow'
import { parseWorkspaceRecovery } from './content-workspace-recovery'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
function fixture() {
  const base = structuredClone(
    defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability,
  )
  return {
    ...base,
    behaviors: base.behaviors.map((group) => ({
      ...group,
      accuracy: { kind: 'fixed' as const, chanceBasisPoints: 7777 },
      effects: [
        {
          id: 'step',
          payload: { type: 'move' as const, recipient: 'actor' as const, maximumTiles: 15 },
        },
      ],
    })),
  }
}
it('greys pure Move attack controls while keeping the raw aim and fixed accuracy recoverable', () => {
  const value = fixture(),
    before = JSON.stringify(value)
  const html = renderToStaticMarkup(<AbilityDefinitionEditor value={value} onChange={() => {}} />)
  expect(html).toMatch(/<fieldset[^>]*disabled[^>]*><legend>Range/)
  expect(html).toMatch(/aria-label="Accuracy rule"[^>]*disabled/)
  expect(html).toContain('77.77%')
  expect(html).not.toContain('Resolve compatibility before publishing')
  expect(withSharedEffectAim(value.behaviors[0]!).targeting).toEqual(value.behaviors[0]!.targeting)
  expect(JSON.stringify(value)).toBe(before)
})
it('retains inactive settings in the existing recovery format while committing only the active view', () => {
  const definition = { id: 'custom.move', ability: fixture() }
  const prepared = correctCombatContentEntries('skill', definition).definition
  expect(prepared.ability).toEqual(activeAbilityForAuthoring(definition.ability))
  const record = {
    contentKind: 'skill',
    current: { definition: prepared },
  } as unknown as CompleteCombatContentRecord
  expect(recordIsDirty(record, definition)).toBe(false)
  const raw = {
    schema: 1,
    category: 'skill',
    selectedKey: 'custom.move',
    tab: 'Parameters',
    search: '',
    sort: 'name-asc',
    listScroll: 0,
    editorScroll: 0,
    newDefinition: null,
    edits: { 'custom.move': { revision: 8, definition } },
  }
  const recovery = parseWorkspaceRecovery(JSON.stringify(raw))!
  expect(recovery.edits['custom.move']!.definition).toEqual(definition)
})

it('reenables reach and accuracy for mixed attacks while leaving selected-target Move requirements editable', () => {
  const value = fixture(),
    attack = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
      .effects[0]!
  const mixed = {
    ...value,
    behaviors: value.behaviors.map((group) => ({ ...group, effects: [...group.effects, attack] })),
  }
  const html = renderToStaticMarkup(<AbilityDefinitionEditor value={mixed} onChange={() => {}} />)
  expect(html).not.toMatch(/<fieldset[^>]*disabled[^>]*><legend>Range/)
  expect(html).not.toMatch(/aria-label="Accuracy rule"[^>]*disabled/)
  const selected = {
    ...value,
    behaviors: value.behaviors.map((group) => ({
      ...group,
      requirements: {
        kind: 'status-presence' as const,
        subject: 'selected' as const,
        statusId: 'guarded',
        present: true,
      },
    })),
  }
  const required = renderToStaticMarkup(
    <AbilityDefinitionEditor value={selected} onChange={() => {}} />,
  )
  expect(required).not.toMatch(/<fieldset[^>]*disabled[^>]*><legend>Range/)
  expect(required).toMatch(/aria-label="Accuracy rule"[^>]*disabled/)
  expect(required).toContain('aria-label="Unit for Target Requirements"')
})
it('disables duplicate Move, conflicting Summon and moving an existing Move after another packet', () => {
  const value = fixture(),
    attack = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
      .effects[0]!
  const mixed = {
    ...value,
    behaviors: value.behaviors.map((group) => ({ ...group, effects: [...group.effects, attack] })),
  }
  const html = renderToStaticMarkup(<AbilityDefinitionEditor value={mixed} onChange={() => {}} />)
  expect(html).toMatch(/value="move"[^>]*disabled/)
  expect(html).toMatch(/value="summon"[^>]*disabled/)
  expect(html).toMatch(/<button[^>]*disabled[^>]*>↓ Down<\/button>/)
})

it('does not mark retained inactive values dirty when persisted JSON object keys are reordered', () => {
  const definition = { id: 'custom.move', ability: fixture() }
  const prepared = correctCombatContentEntries('skill', definition).definition
  function sorted(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sorted)
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [key, sorted(child)]),
      )
    return value
  }
  const record = {
    contentKind: 'skill',
    current: { definition: sorted(prepared) },
  } as unknown as CompleteCombatContentRecord
  expect(recordIsDirty(record, definition)).toBe(false)
})

it('authors an independent enemy Requirement aim from a freshly committed pure Move without changing its destination', () => {
  const active = activeAbilityForAuthoring(fixture())
  const value = {
    ...active,
    behaviors: active.behaviors.map((group) => ({
      ...group,
      requirements: {
        kind: 'status-presence' as const,
        subject: 'selected' as const,
        statusId: 'guarded',
        present: true,
      },
    })),
  }
  let changed = value as typeof active
  type Props = Record<string, unknown> & { children?: ReactNode }
  function control(node: ReactNode): ReactElement<Props> | undefined {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = control(child)
        if (found) return found
      }
      return
    }
    if (!isValidElement<Props>(node)) return
    if (node.props.label === 'Unit for Target Requirements') return node
    if (typeof node.type === 'function' && node.type.name === 'AbilityGroupEditor')
      return control((node.type as (props: Props) => ReactNode)(node.props))
    return control(node.props.children)
  }
  const tree = AbilityDefinitionEditor({
    value,
    onChange: (next) => {
      changed = next
    },
  })
  const field = control(tree)!
  expect(field).toBeDefined()
  ;(field.props.onChange as (target: string) => void)('enemy')
  expect(changed.behaviors[0]!.targeting).toMatchObject({
    kind: 'unit',
    categories: ['enemy'],
    maximumRange: 1,
    shape: { kind: 'single' },
  })
  expect(changed.behaviors[0]!.effects).toEqual(value.behaviors[0]!.effects)
  expect(changed.behaviors[0]!.requirements).toEqual(value.behaviors[0]!.requirements)
  expect(changed.behaviors[0]!.costs).toEqual(value.behaviors[0]!.costs)
})
