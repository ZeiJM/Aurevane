import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
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
import { NewDisciplineSkill } from './new-discipline-skill'
type Props = {
  children?: ReactNode
  disabled?: boolean
  onClick?(): Promise<void>
  onChange?(event: { currentTarget: { value: string } }): void
}
function find(node: ReactNode, type: string): ReactElement<Props> | null {
  if (Array.isArray(node)) return node.map((child) => find(child, type)).find(Boolean) ?? null
  if (!isValidElement<Props>(node)) return null
  return node.type === type ? node : find(node.props.children, type)
}
const parent = { contentKey: 'discipline.example', revision: 3 } as CompleteCombatContentRecord
const blank = { ...latestEnabledMatureSkills()[0]! }
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())
function mount(count = 0) {
  const created = vi.fn(),
    busy = vi.fn()
  const render = () => {
    hooks.index = 0
    return NewDisciplineSkill({
      parent,
      count,
      choices: [],
      blank,
      disabled: false,
      recoveryScope: 'owner',
      onCreated: created,
      onBusyChange: busy,
    })
  }
  return { render, created, busy }
}
it('creates an independent Skill under its selected Discipline and opens the returned draft', async () => {
  const created = { contentKey: 'skill.created', contentKind: 'skill' }
  const commands: Record<string, unknown>[] = []
  vi.stubGlobal('fetch', async (_url: unknown, input: RequestInit) => {
    const { command } = JSON.parse(String(input.body))
    commands.push(command)
    return Response.json({
      record: command.action === 'create' ? created : { ...parent, revision: 4 },
    })
  })
  const field = mount()
  await find(field.render(), 'button')!.props.onClick!()
  expect(commands[0]).toMatchObject({
    action: 'create',
    parentKey: parent.contentKey,
    expectedParentRevision: 3,
    definition: { sourceDisciplineId: parent.contentKey, name: 'New Skill' },
  })
  await vi.waitFor(() =>
    expect(field.created).toHaveBeenCalledWith(created, { ...parent, revision: 4 }),
  )
  expect(field.busy.mock.calls.map(([value]) => value)).toEqual([true, false])
  expect(localStorage.getItem(`master-skill-create:v1:owner:${parent.contentKey}`)).toBeNull()
})
it('retries the identical creation intent after an uncertain response rather than creating another Skill', async () => {
  const commands: Record<string, unknown>[] = []
  let first = true
  vi.stubGlobal('fetch', async (_url: unknown, input: RequestInit) => {
    const { command } = JSON.parse(String(input.body))
    commands.push(command)
    if (first) {
      first = false
      throw new Error('Connection interrupted')
    }
    return Response.json({
      record: command.action === 'create' ? { contentKey: 'skill.created' } : parent,
    })
  })
  const field = mount()
  await find(field.render(), 'button')!.props.onClick!()
  await vi.waitFor(() => expect(field.busy).toHaveBeenLastCalledWith(false))
  expect(field.created).not.toHaveBeenCalled()
  await find(field.render(), 'button')!.props.onClick!()
  await vi.waitFor(() => expect(field.created).toHaveBeenCalledTimes(1))
  expect(commands[1]).toEqual(commands[0])
  expect(field.created).toHaveBeenCalledTimes(1)
})
it('disables creation when all eight slots are filled', () => {
  expect(find(mount(8).render(), 'button')!.props.disabled).toBe(true)
})

it('keeps template selection available if reading a template fails before creation', async () => {
  vi.stubGlobal('fetch', async () => {
    throw new Error('Template unavailable')
  })
  const field = mount()
  find(field.render(), 'select')!.props.onChange!({ currentTarget: { value: 'skill.template' } })
  find(field.render(), 'button')!.props.onClick!()
  await vi.waitFor(() => expect(field.busy).toHaveBeenLastCalledWith(false))
  expect(find(field.render(), 'select')!.props.disabled).toBe(false)
  expect(localStorage.getItem(`master-skill-create:v1:owner:${parent.contentKey}`)).toBeNull()
  expect(field.created).not.toHaveBeenCalled()
})

it('allows changing the starting point after a definitive initial creation rejection', async () => {
  vi.stubGlobal('fetch', async () =>
    Response.json(
      { error: { code: 'INVALID_REQUEST', message: 'All eight slots are filled.' } },
      { status: 400 },
    ),
  )
  const field = mount()
  find(field.render(), 'button')!.props.onClick!()
  await vi.waitFor(() => expect(field.busy).toHaveBeenLastCalledWith(false))
  expect(find(field.render(), 'select')!.props.disabled).toBe(false)
  expect(localStorage.getItem(`master-skill-create:v1:owner:${parent.contentKey}`)).toBeNull()
})
