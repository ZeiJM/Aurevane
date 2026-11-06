import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ refs: [] as { current: unknown }[], index: 0 }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useRef(initial: unknown) {
    const index = hooks.index++
    return (hooks.refs[index] ??= { current: initial })
  },
}))
vi.mock('server-only', () => ({}))
import { ItemImbuedTechniqueEditor } from './item-imbued-technique-editor'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { FinalizedMediaEditor } from './finalized-media-editor'
import { AbilityEditorTabs } from './ability-editor-tabs'
import { AbilitySelect, AbilityText, AbilityNumber } from './ability-editor-fields'
import { AbilityCostEditor } from './ability-cost-editor'
import { itemFixture } from '../../../../../../packages/game-core/src/content/items-test-fixtures'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseRuntimeItemDefinition } from '@aurevane/game-core/content/items'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import {
  parseBattleEquipmentCapture,
  compileEquipmentAbility,
} from '@aurevane/game-core/combat/combat-equipment'
import { captureEquipmentAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import { combatAbilityCommandContext } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { percentageDotEncounter } from '../../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import {
  PV1F_COMBAT_CONTENT,
  preparePv1fTurnEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'

type Props = Record<string, unknown> & { children?: ReactNode }
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  return isValidElement<Props>(node) ? [node, ...nodes(node.props.children)] : []
}
function weapon() {
  const ability = structuredClone(
    defaultBasicSkills().find((s) => s.id === 'unarmed.basic')!.ability!,
  )
  return itemFixture({
    id: 'test.sword',
    name: 'Test Sword',
    sortOrder: 317,
    itemClass: 'weapon',
    equipment: { slot: 'hand', hands: 1 },
    ability,
    actions: { attack: { behaviorId: ability.behaviors[0]!.id, name: 'Cut' } },
  })
}
function editor(initial = weapon(), onPendingMediaChange?: (pending: boolean) => void) {
  let value = initial
  const render = () => {
    hooks.index = 0
    return ItemImbuedTechniqueEditor({
      value,
      onPendingMediaChange,
      onChange: (next) => {
        value = next
      },
    })
  }
  const toggle = () =>
    (
      nodes(render()).find((n) => n.type === 'input' && n.props.type === 'checkbox')!.props
        .onChange as () => void
    )()
  return { render, toggle, value: () => value }
}
beforeEach(() => {
  hooks.refs = []
  hooks.index = 0
})

it('starts optional, enables the actual shared editor, and restores same-session edits without changing the attack or Item fields', () => {
  const initial = weapon(),
    before = structuredClone(initial),
    form = editor(initial)
  expect(renderToStaticMarkup(form.render())).toContain('Enable imbued technique')
  expect(nodes(form.render()).find((n) => n.type === AbilityEditorTabs)).toBeUndefined()
  form.toggle()
  const binding = form.value().actions!.support!
  expect(binding.behaviorId).not.toBe(initial.actions!.attack!.behaviorId)
  const name = nodes(form.render()).find(
    (n) => n.type === AbilityText && n.props.label === 'Technique name',
  )!
  ;(name.props.onChange as (value: string) => void)('Sunward Prayer')
  const tabs = nodes(form.render()).find((n) => n.type === AbilityEditorTabs)!
  const execution = (tabs.props.panels as Record<string, ReactElement<Props>>).execution
  expect(execution.type).toBe(AbilityDefinitionEditor)
  const definition = AbilityDefinitionEditor(
    execution.props as Parameters<typeof AbilityDefinitionEditor>[0],
  )
  const group = nodes(definition).find(
    (n) => typeof n.type === 'function' && n.type.name === 'AbilityGroupEditor',
  )!
  const groupTree = (group.type as (props: Props) => ReactNode)(group.props)
  const cost = nodes(groupTree).find((n) => n.type === AbilityCostEditor)!
  const costs = AbilityCostEditor(cost.props as Parameters<typeof AbilityCostEditor>[0])
  const ap = nodes(costs).find((n) => n.type === AbilityNumber && n.props.label === 'AP cost')!
  ;(ap.props.onChange as (value: number) => void)(37)
  const authored = parseRuntimeItemDefinition(JSON.parse(JSON.stringify(form.value())))
  expect(authored.actions!.support!.name).toBe('Sunward Prayer')
  expect(
    authored.ability!.behaviors.find((b) => b.id === binding.behaviorId)!.costs,
  ).toContainEqual({ resource: 'ap', amount: 37 })
  expect(authored.ability!.behaviors[0]).toEqual(before.ability!.behaviors[0])
  expect(authored.actions!.attack).toEqual(before.actions!.attack)
  expect({ ...authored, ability: before.ability, actions: before.actions }).toEqual(before)
  form.toggle()
  expect(parseRuntimeItemDefinition(form.value())).toEqual(before)
  expect(renderToStaticMarkup(form.render())).toContain('Commit')
  form.toggle()
  expect(parseRuntimeItemDefinition(form.value())).toEqual(authored)
  expect(initial).toEqual(before)
})

it('keeps existing valid techniques unchanged and repairs unavailable actions with friendly manual choices', () => {
  const initial = weapon()
  const prayer = {
    ...structuredClone(
      defaultBasicSkills().find((s) => s.id === 'basic.recover')!.ability!.behaviors[0]!,
    ),
    id: 'prayer',
  }
  const valid = {
    ...initial,
    ability: { schemaVersion: 1 as const, behaviors: [...initial.ability!.behaviors, prayer] },
    actions: { ...initial.actions, support: { behaviorId: 'prayer', name: 'Warding Prayer' } },
  }
  const unchanged = editor(valid)
  unchanged.render()
  expect(unchanged.value()).toEqual(valid)
  const form = editor({
    ...valid,
    actions: { ...valid.actions, support: { behaviorId: 'missing', name: 'Warding Prayer' } },
  })
  const select = nodes(form.render()).find(
    (n) => n.type === AbilitySelect && n.props.label === 'Technique action',
  )!
  const labels = Object.values(select.props.optionLabels as object).join(' ')
  expect(labels).toContain('Unavailable action')
  expect(labels).toContain('Recovery')
  expect(labels).not.toContain('prayer')
  ;(select.props.onChange as (id: string) => void)('prayer')
  expect(parseRuntimeItemDefinition(form.value()).actions!.support).toEqual({
    behaviorId: 'prayer',
    name: 'Warding Prayer',
  })
})

it('captures and executes the authored technique only while selected, preserving its Basic Attack separately', () => {
  const form = editor()
  form.toggle()
  const authored = parseRuntimeItemDefinition(JSON.parse(JSON.stringify(form.value())))
  const behaviorId = authored.actions!.support!.behaviorId
  const capture = parseBattleEquipmentCapture({
    schemaVersion: 2,
    inventoryRevision: 1,
    selectedSupport: { kind: 'equipment', position: 'main-hand', itemId: authored.id, behaviorId },
    equipment: [{ position: 'main-hand', ownedStackId: 'owned-sword', item: authored }],
  })
  expect(
    compileEquipmentAbility(capture, capture.equipment[0]!).behaviors.map((b) => b.id),
  ).toEqual(authored.ability!.behaviors.map((b) => b.id))
  const source = captureEquipmentAbilitySource(capture, capture.equipment[0]!, 'actor')!
  const full = preparePv1fTurnEconomy(percentageDotEncounter())
  const state = {
    ...full,
    tactical: {
      ...full.tactical,
      battle: {
        ...full.tactical.battle,
        combatants: full.tactical.battle.combatants.map((row) =>
          row.id === 'actor' ? { ...row, hp: 400 } : row,
        ),
      },
    },
  }
  const quote = prepareCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source, behaviorId },
    selection: { kind: 'self' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  })
  expect(quote.action.id).toBe(`item.${authored.id}.main-hand.support`)
  expect(quote.action.effects[0]).toMatchObject({ type: 'percentage-recovery', resource: 'hp' })
  const committed = commitCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source, behaviorId },
    selection: { kind: 'self' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  })
  expect(
    committed.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp,
  ).toBeGreaterThan(400)
  expect(
    committed.state.tactical.battle.combatants
      .find((row) => row.id === 'actor')!
      .temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current,
  ).toBe(50)
  const ordinary = {
    ...capture,
    selectedSupport: { kind: 'basic' as const, actionId: 'basic.recover' as const },
  }
  expect(
    compileEquipmentAbility(ordinary, capture.equipment[0]!).behaviors.map((b) => b.id),
  ).toEqual([authored.actions!.attack!.behaviorId])
  expect((form.value().ability as AbilityDefinition).behaviors).toHaveLength(2)
})

it('repairs a missing technique action directly without resetting its name or weapon attack', () => {
  const initial = weapon()
  const form = editor({
    ...initial,
    actions: { ...initial.actions, support: { behaviorId: 'unavailable', name: 'Ancient Prayer' } },
  })
  const create = nodes(form.render()).find(
    (node) => node.type === 'button' && node.props.children === 'Create technique action',
  )
  expect(create).toBeDefined()
  ;(create!.props.onClick as () => void)()
  const repaired = parseRuntimeItemDefinition(form.value())
  expect(repaired.actions!.support!.name).toBe('Ancient Prayer')
  expect(repaired.actions!.support!.behaviorId).not.toBe(initial.actions!.attack!.behaviorId)
  expect(repaired.actions!.attack).toEqual(initial.actions!.attack)
  expect(repaired.ability!.behaviors[0]).toEqual(initial.ability!.behaviors[0])
})

it('edits finalized image-only technique media, preserves it through selection and toggle, and removes only the upload', () => {
  const form = editor()
  form.toggle()
  const binding = form.value().actions!.support!
  const base = form.value()
  const builtin = 'item.twinfang-blade.technique.art.v1'
  const initial = {
    ...base,
    actions: { ...base.actions, support: { ...binding, media: { artworkId: builtin } } },
  }
  const pending = vi.fn()
  const withMedia = editor(initial, pending)
  const panel = () =>
    (
      nodes(withMedia.render()).find((n) => n.type === AbilityEditorTabs)!.props.panels as Record<
        string,
        ReactElement<Props>
      >
    ).media!
  expect(panel().type).toBe(FinalizedMediaEditor)
  expect(panel().props.allowAudio).toBe(false)
  ;(panel().props.onPendingMediaChange as (value: boolean) => void)(true)
  expect(pending).toHaveBeenLastCalledWith(true)
  const artwork = {
    id: '00000000-0000-4000-8000-000000000099',
    kind: 'image' as const,
    checksum: 'a'.repeat(64),
    byteLength: 100,
    contentType: 'image/png' as const,
    width: 128,
    height: 128,
    sourceWidth: 128,
    sourceHeight: 128,
    crop: { x: 0, y: 0, size: 128 },
  }
  ;(panel().props.onChange as (v: object) => void)({ artwork })
  expect(parseRuntimeItemDefinition(withMedia.value()).actions!.support!.media).toEqual({
    artworkId: builtin,
    artwork,
  })
  const select = nodes(withMedia.render()).find(
    (n) => n.type === AbilitySelect && n.props.label === 'Technique action',
  )!
  ;(select.props.onChange as (id: string) => void)(binding.behaviorId)
  expect(withMedia.value().actions!.support!.media?.artwork).toEqual(artwork)
  withMedia.toggle()
  withMedia.toggle()
  expect(withMedia.value().actions!.support!.media?.artwork).toEqual(artwork)
  ;(panel().props.onChange as (v: object) => void)({})
  expect(withMedia.value().actions!.support!.media).toEqual({ artworkId: builtin })
  expect(withMedia.value().actions!.attack).toEqual(base.actions!.attack)
})
