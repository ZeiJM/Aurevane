import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffect() {},
  useState(initial: unknown) {
    const index = hooks.index++
    if (!(index in hooks.cells)) hooks.cells[index] = initial
    return [
      hooks.cells[index],
      (value: unknown) => {
        hooks.cells[index] = value
      },
    ]
  },
  useRef(initial: unknown) {
    const index = hooks.index++
    if (!(index in hooks.cells)) hooks.cells[index] = { current: initial }
    return hooks.cells[index]
  },
}))
import { DeleteDiscipline } from './delete-discipline'
type Props = {
  children?: ReactNode
  disabled?: boolean
  onClick?(): void
  onChange?(event: { currentTarget: { checked: boolean } }): void
  href?: string
}
function nodes(node: ReactNode, type: string): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, type))
  if (!isValidElement<Props>(node)) return []
  return [...(node.type === type ? [node] : []), ...nodes(node.props.children, type)]
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join('')
  if (isValidElement<Props>(node)) return text(node.props.children)
  return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
})
afterEach(() => vi.unstubAllGlobals())
function mount(blocked = false) {
  const commands: Record<string, unknown>[] = []
  const deleted = vi.fn(),
    busy = vi.fn()
  vi.stubGlobal('fetch', async (_url: unknown, input: RequestInit) => {
    const { command } = JSON.parse(String(input.body))
    commands.push(command)
    return Response.json(
      command.action === 'review-deletion'
        ? {
            plan: {
              token: 'a'.repeat(32),
              records: [
                {
                  contentKey: 'discipline.example',
                  name: 'Example',
                  revision: 1,
                  contentKind: 'discipline',
                },
              ],
              blockers: blocked
                ? [
                    {
                      contentKey: 'discipline.example',
                      key: '00000000-0000-4000-8000-000000000001',
                      name: 'Zei',
                      kind: 'active-discipline',
                    },
                  ]
                : [],
              blockerCount: blocked ? 1 : 0,
            },
          }
        : { deletedKeys: ['discipline.example'] },
    )
  })
  const render = () => {
    hooks.index = 0
    return DeleteDiscipline({
      contentKey: 'discipline.example',
      name: 'Example',
      disabled: false,
      onDeleted: deleted,
      onBusyChange: busy,
    })
  }
  const button = (name: string) => nodes(render(), 'button').find((node) => text(node) === name)!
  return { render, button, commands, deleted, busy }
}
it('reviews without deleting, requires confirmation and clears only the returned identities', async () => {
  const field = mount()
  field.button('Delete Discipline…').props.onClick!()
  await vi.waitFor(() => expect(nodes(field.render(), 'input')).toHaveLength(1))
  expect(field.commands).toEqual([{ action: 'review-deletion', contentKey: 'discipline.example' }])
  expect(field.button('Delete permanently').props.disabled).toBe(true)
  nodes(field.render(), 'input')[0]!.props.onChange!({ currentTarget: { checked: true } })
  field.button('Delete permanently').props.onClick!()
  await vi.waitFor(() => expect(field.deleted).toHaveBeenCalledWith(['discipline.example']))
  expect(field.commands[1]).toEqual({
    action: 'delete-discipline',
    contentKey: 'discipline.example',
    reviewToken: 'a'.repeat(32),
  })
  expect(field.busy.mock.calls).toEqual([[true], [false]])
})
it('blocks deletion for a dependency and links directly to the affected player', async () => {
  const field = mount(true)
  field.button('Delete Discipline…').props.onClick!()
  await vi.waitFor(() => expect(nodes(field.render(), 'a')).toHaveLength(1))
  expect(nodes(field.render(), 'a')[0]!.props.href).toBe(
    '/master/players?characterId=00000000-0000-4000-8000-000000000001',
  )
  expect(field.button('Delete permanently').props.disabled).toBe(true)
  field.button('Delete permanently').props.onClick!()
  expect(field.commands).toHaveLength(1)
})
it('cancel closes the review without a mutation', async () => {
  const field = mount()
  field.button('Delete Discipline…').props.onClick!()
  await vi.waitFor(() => expect(nodes(field.render(), 'input')).toHaveLength(1))
  field.button('Cancel').props.onClick!()
  expect(nodes(field.render(), 'dialog')).toHaveLength(0)
  expect(field.commands).toHaveLength(1)
})
