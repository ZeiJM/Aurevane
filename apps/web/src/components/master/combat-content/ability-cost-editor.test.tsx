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
it('adds HP alongside MP, edits each amount, and removes only the selected resource', () => {
  let costs: AbilityBehavior['costs'] = [
    { resource: 'ap', amount: 10 },
    { resource: 'mp', amount: 4 },
  ]
  const render = () =>
    controls(
      AbilityCostEditor({
        costs,
        onChange: (next) => {
          costs = next
        },
      }),
    )
  const add = render().find(
    (control) =>
      control.type === 'button' &&
      control.props.children instanceof Array &&
      control.props.children.join('') === 'Add HP cost',
  )!
  ;(add.props.onClick as () => void)()
  expect(costs).toEqual([
    { resource: 'ap', amount: 10 },
    { resource: 'mp', amount: 4 },
    { resource: 'hp', amount: 1 },
  ])
  const hp = render().find(
    (control) => control.type === AbilityNumber && control.props.label === 'HP cost',
  )!
  ;(hp.props.onChange as (amount: number) => void)(6)
  expect(costs.at(-1)).toEqual({ resource: 'hp', amount: 6 })
  const remove = render().find(
    (control) =>
      control.type === 'button' &&
      Array.isArray(control.props.children) &&
      control.props.children.join('') === 'Remove MP cost',
  )!
  ;(remove.props.onClick as () => void)()
  expect(costs).toEqual([
    { resource: 'ap', amount: 10 },
    { resource: 'hp', amount: 6 },
  ])
})
