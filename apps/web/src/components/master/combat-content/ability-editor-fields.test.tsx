import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useId: () => 'ability-number-test',
  useState(initial: unknown) {
    const index = hooks.index++
    if (!(index in hooks.cells)) hooks.cells[index] = initial
    return [
      hooks.cells[index],
      (next: unknown) => {
        hooks.cells[index] = next
      },
    ]
  },
}))
import { AbilityNumber } from './ability-editor-fields'
type InputProps = {
  children?: ReactNode
  value: string | number
  onChange(event: { currentTarget: { value: string } }): void
  onBlur?(): void
}
function input(node: ReactNode): ReactElement<InputProps> {
  if (Array.isArray(node)) {
    for (const child of node) {
      try {
        return input(child)
      } catch {
        /* inspect the next child */
      }
    }
  }
  if (isValidElement<InputProps>(node)) {
    if (node.type === 'input') return node
    return input(node.props.children)
  }
  throw new Error('Input missing')
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
})
function mount(initial = 1) {
  let value = initial
  const changes: number[] = []
  const render = () => {
    hooks.index = 0
    return input(
      AbilityNumber({
        label: 'Might base',
        min: 1,
        value,
        onChange(next) {
          value = next
          changes.push(next)
        },
      }),
    ).props
  }
  return {
    render,
    changes,
    external(next: number) {
      value = next
    },
  }
}
it('lets the Owner clear a stat and type a replacement without injecting zero', () => {
  const field = mount(15)
  field.render().onChange({ currentTarget: { value: '' } })
  expect(field.render().value).toBe('')
  expect(field.changes).toEqual([])
  field.render().onChange({ currentTarget: { value: '12' } })
  expect(Number(field.render().value)).toBe(12)
  expect(field.changes).toEqual([12])
})
it('normalizes leading zeroes on blur while preserving genuine zero and decimals', () => {
  const field = mount()
  field.render().onChange({ currentTarget: { value: '012' } })
  field.render().onBlur?.()
  expect(String(field.render().value)).toBe('12')
  field.render().onChange({ currentTarget: { value: '0' } })
  expect(field.changes.at(-1)).toBe(0)
  field.render().onChange({ currentTarget: { value: '0.25' } })
  expect(field.changes.at(-1)).toBe(0.25)
})
it('restores the last valid value on empty blur and respects external updates', () => {
  const field = mount(15)
  field.render().onChange({ currentTarget: { value: '' } })
  field.render().onBlur?.()
  expect(String(field.render().value)).toBe('15')
  field.render().onChange({ currentTarget: { value: '' } })
  field.external(9)
  expect(String(field.render().value)).toBe('9')
  expect(field.changes).toEqual([])
})
