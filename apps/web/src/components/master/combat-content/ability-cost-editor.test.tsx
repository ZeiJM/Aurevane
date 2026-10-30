import { isValidElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { AbilityCostEditor } from './ability-cost-editor'
import { AbilityNumber } from './ability-editor-fields'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'

function controls(node: ReactNode): { type: unknown; props: Record<string, unknown> }[] {
  if (Array.isArray(node)) return node.flatMap(controls)
  if (!isValidElement<{ children?: ReactNode }>(node)) return []
  return [{ type: node.type, props: node.props }, ...controls(node.props.children)]
}
it('edits optional costs directly, preserving payment order and untouched captured zero costs', () => {
  let costs: AbilityBehavior['costs'] = [
    { resource: 'mp', amount: 0 },
    { resource: 'ap', amount: 10 },
  ]
  const before = structuredClone(costs)
  const render = () =>
    controls(
      AbilityCostEditor({
        costs,
        onChange: (next) => {
          costs = next
        },
      }),
    )
  const edit = (label: string, amount: number) => {
    const control = render().find(
      (entry) => entry.type === AbilityNumber && entry.props.label === label,
    )!
    ;(control.props.onChange as (amount: number) => void)(amount)
  }
  expect(render().filter((entry) => entry.type === AbilityNumber)).toHaveLength(3)
  expect(render().some((entry) => entry.type === 'button')).toBe(false)
  expect(costs).toEqual(before)
  edit('HP cost', 6)
  expect(costs).toEqual([...before, { resource: 'hp', amount: 6 }])
  edit('AP cost', 20)
  expect(costs[0]).toEqual(before[0])
  edit('HP cost', 0)
  expect(costs).toEqual([
    { resource: 'mp', amount: 0 },
    { resource: 'ap', amount: 20 },
  ])
  edit('MP cost', 4)
  expect(costs).toEqual([
    { resource: 'mp', amount: 4 },
    { resource: 'ap', amount: 20 },
  ])
  edit('MP cost', 0)
  expect(costs).toEqual([{ resource: 'ap', amount: 20 }])
})
