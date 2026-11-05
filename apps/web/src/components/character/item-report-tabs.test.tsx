import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
const hook = vi.hoisted(() => ({ state: undefined as unknown }))
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  return {
    ...actual,
    useId: () => ':item-report:',
    useState(initial: unknown) {
      if (
        !initial ||
        typeof initial !== 'object' ||
        !('identity' in initial) ||
        !('index' in initial)
      )
        return actual.useState(initial)
      if (hook.state === undefined) hook.state = initial
      return [
        hook.state,
        (next: unknown) => {
          hook.state = next
        },
      ]
    },
  }
})
import { ItemReportTabs } from './item-report-tabs'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { itemFixture } from '../../../../../packages/game-core/src/content/items-test-fixtures'
import { presentItem } from '@/lib/items/item-presentation'

type Props = Record<string, unknown> & { children?: ReactNode }
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  return isValidElement<Props>(node) ? [node, ...nodes(node.props.children)] : []
}
function fixture() {
  const attack = structuredClone(
    defaultBasicSkills().find((s) => s.id === 'unarmed.basic')!.ability!.behaviors[0]!,
  )
  const prayer = {
    ...structuredClone(
      defaultBasicSkills().find((s) => s.id === 'basic.recover')!.ability!.behaviors[0]!,
    ),
    id: 'prayer',
  }
  return presentItem(
    itemFixture({
      id: 'test.weapon',
      itemClass: 'weapon',
      equipment: { slot: 'hand', hands: 1 },
      ability: { schemaVersion: 1, behaviors: [attack, prayer] },
      actions: {
        attack: { behaviorId: attack.id, name: 'Cut' },
        support: { behaviorId: prayer.id, name: 'Sunward Prayer' },
      },
    }),
  )
}
beforeEach(() => {
  hook.state = undefined
})
it('separates only the imbued report and its effect explanations into the extra tab', () => {
  const item = fixture()
  const render = () =>
    ItemReportTabs({ itemId: item.id, reports: item.reports, supportBehaviorId: 'prayer' })
  const tabs = () => nodes(render()).filter((n) => n.props.role === 'tab')
  expect(tabs().map((n) => n.props.children)).toEqual(['Item Details', 'Imbued Technique'])
  const panels = nodes(render()).filter((n) => n.props.role === 'tabpanel')
  const details = renderToStaticMarkup(panels[0]!.props.children)
  const technique = renderToStaticMarkup(panels[1]!.props.children)
  expect(details).toContain('Cut')
  expect(details).not.toContain('Sunward Prayer')
  expect(details).not.toContain('Restore 15%')
  expect(technique).toContain('Sunward Prayer')
  expect(technique).not.toContain('>Cut<')
  expect(technique).toContain('data-ability-parameters')
  expect(technique).toContain('aria-label="Effect explanations"')
  expect(technique).toContain('Requirements')
  expect(technique).toContain('Cooldown')
  expect(panels.map((n) => n.props.hidden)).toEqual([false, true])
  ;(tabs()[1]!.props.onClick as () => void)()
  expect(
    nodes(render())
      .filter((n) => n.props.role === 'tabpanel')
      .map((n) => n.props.hidden),
  ).toEqual([true, false])
})
it('keeps ordinary reports together without tabs for absent or unavailable weapon techniques', () => {
  const item = fixture()
  for (const supportBehaviorId of [undefined, 'missing']) {
    const tree = ItemReportTabs({ itemId: item.id, reports: item.reports, supportBehaviorId })
    expect(nodes(tree).filter((n) => n.props.role === 'tab')).toHaveLength(0)
    const html = renderToStaticMarkup(tree)
    expect(html).toContain('Cut')
    expect(html).toContain('Sunward Prayer')
  }
})
it('supports keyboard tabs and resets selection for another Item or removed and restored technique', () => {
  const item = fixture()
  const render = (itemId = item.id, supportBehaviorId: string | undefined = 'prayer') =>
    ItemReportTabs({ itemId, reports: item.reports, supportBehaviorId })
  const tabs = (tree: ReactNode) => nodes(tree).filter((n) => n.props.role === 'tab')
  const focus = vi.fn()
  ;(tabs(render())[0]!.props.onKeyDown as (event: unknown) => void)({
    key: 'ArrowRight',
    preventDefault: vi.fn(),
    currentTarget: { parentElement: { querySelectorAll: () => [{ focus: vi.fn() }, { focus }] } },
  })
  expect(focus).toHaveBeenCalledOnce()
  expect(tabs(render())[1]!.props['aria-selected']).toBe(true)
  expect(tabs(render('another-item'))[0]!.props['aria-selected']).toBe(true)
  ;(tabs(render('another-item'))[1]!.props.onClick as () => void)()
  expect(tabs(render('another-item', 'missing'))).toHaveLength(0)
  expect(tabs(render('another-item'))[0]!.props['aria-selected']).toBe(true)
})

it('omits repeated ongoing maintenance prose while preserving the Item Requirements and effects report', () => {
  const item = presentItem(
    itemFixture({
      ability: {
        schemaVersion: 1,
        behaviors: [
          {
            id: 'ward',
            activation: 'ongoing',
            mode: 'modifier',
            classification: 'utility',
            targeting: null,
            costs: [],
            cooldown: null,
            requirements: {
              kind: 'resource-state',
              subject: 'owner',
              resource: 'hp',
              comparison: 'at-least',
              basisPoints: 1,
            },
            effects: [
              {
                id: 'power',
                payload: {
                  type: 'stat-bonus',
                  recipient: 'actor',
                  stat: 'physical-power',
                  amount: 4,
                },
              },
            ],
          },
        ],
      },
    }),
  )
  expect(item.reports[0]!.maintenance).toBe('Ends when its source is removed.')
  const html = renderToStaticMarkup(ItemReportTabs({ itemId: item.id, reports: item.reports }))
  expect(html).not.toContain('Ends when its source is removed.')
  expect(html).not.toContain('while Requirements are met')
  expect(html).toContain('Requirements')
  expect(html).toContain('Effects')
  expect(html).toContain('Power')
})
