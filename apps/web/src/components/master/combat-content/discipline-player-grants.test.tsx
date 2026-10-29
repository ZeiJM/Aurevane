import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({
  index: 0,
  cells: [] as unknown[],
  effects: [] as (() => void)[],
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useId: () => 'grant-reason',
  useState(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = initial
    return [
      hooks.cells[i],
      (next: unknown) => {
        hooks.cells[i] =
          typeof next === 'function' ? (next as (value: unknown) => unknown)(hooks.cells[i]) : next
      },
    ]
  },
  useRef(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = { current: initial }
    return hooks.cells[i]
  },
  useCallback(callback: unknown, dependencies: unknown[]) {
    const i = hooks.index++
    const old = hooks.cells[i] as { callback: unknown; dependencies: unknown[] } | undefined
    if (!old || dependencies.some((value, index) => value !== old.dependencies[index]))
      hooks.cells[i] = { callback, dependencies }
    return (hooks.cells[i] as { callback: unknown }).callback
  },
  useEffect(effect: () => void, dependencies: unknown[]) {
    const i = hooks.index++
    const old = hooks.cells[i] as unknown[] | undefined
    if (!old || dependencies.some((value, index) => value !== old[index])) {
      hooks.cells[i] = dependencies
      hooks.effects.push(effect)
    }
  },
}))
import { DisciplinePlayerGrants } from './discipline-player-grants'

type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (element: ReactElement<Props>) => boolean,
): ReactElement<Props> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate)
      if (found) return found
    }
  }
  if (!isValidElement<Props>(node)) return
  return predicate(node) ? node : find(node.props.children, predicate)
}
const accountId = '00000000-0000-4000-8000-000000000012'
const grant = { accountId, name: 'Existing Player' }
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  hooks.effects = []
})
afterEach(() => vi.unstubAllGlobals())
function fixture(
  mutate: (body: Record<string, unknown>) => Promise<Response> = async () =>
    Response.json({ result: { changed: 1 } }),
) {
  let grants = [grant]
  const mutations: Record<string, unknown>[] = []
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body)) as Record<string, unknown>
    if (body.operation === 'read') return Response.json({ result: grants })
    mutations.push(body)
    const response = await mutate(body)
    if (response.ok) grants = []
    return response
  })
  function render() {
    hooks.index = 0
    const editor = DisciplinePlayerGrants({ disciplineId: 'discipline.custom' })
    const tree = (editor.type as (props: typeof editor.props) => ReactNode)(editor.props)
    for (const effect of hooks.effects.splice(0)) effect()
    return tree
  }
  const button = () =>
    find(render(), (node) => node.type === 'button' && node.props.children === 'Revoke grant')
  const reason = () =>
    find(render(), (node) => node.type === 'input' && node.props.maxLength === 500)!
  const click = () => (button()!.props.onClick as () => void)()
  const changeReason = (value: string) =>
    (reason().props.onChange as (event: unknown) => void)({ target: { value } })
  render()
  return { render, button, reason, click, changeReason, mutations }
}

it('keeps existing-row revoke actionable and focuses the required reason without searching or mutating', async () => {
  const f = fixture()
  await vi.waitFor(() => expect(f.button()).toBeDefined())
  expect(f.button()!.props.disabled).toBe(false)
  const focus = vi.fn()
  ;(f.reason().props.ref as { current: unknown }).current = { focus }
  f.click()
  expect(f.mutations).toEqual([])
  expect(focus).toHaveBeenCalledOnce()
  expect(f.reason().props['aria-invalid']).toBe(true)
  expect(find(f.render(), (node) => node.props.role === 'alert')?.props.children).toBe(
    'Enter a reason to revoke this grant.',
  )
  f.changeReason('   ')
  f.click()
  expect(f.mutations).toEqual([])
})

it('revokes only the existing row account with its reason and prevents duplicate pending requests', async () => {
  let resolve!: (response: Response) => void
  const f = fixture(
    () =>
      new Promise<Response>((done) => {
        resolve = done
      }),
  )
  await vi.waitFor(() => expect(f.button()).toBeDefined())
  f.changeReason('  Owner access adjustment  ')
  const onClick = f.button()!.props.onClick as () => void
  onClick()
  onClick()
  expect(f.mutations).toEqual([
    {
      operation: 'revoke',
      disciplineId: 'discipline.custom',
      accountIds: [accountId],
      reason: 'Owner access adjustment',
    },
  ])
  expect(f.button()!.props.disabled).toBe(true)
  resolve(Response.json({ result: { changed: 1 } }))
  await vi.waitFor(() => expect(f.button()).toBeUndefined())
})

it('retains the grant and audit reason after server refusal so the owner can retry', async () => {
  let attempts = 0
  const f = fixture(async () =>
    ++attempts === 1
      ? Response.json({ error: { message: 'Game Content access is required.' } }, { status: 403 })
      : Response.json({ result: { changed: 1 } }),
  )
  await vi.waitFor(() => expect(f.button()).toBeDefined())
  f.changeReason('Owner access adjustment')
  f.click()
  await vi.waitFor(() =>
    expect(find(f.render(), (node) => node.props.role === 'alert')?.props.children).toBe(
      'Game Content access is required.',
    ),
  )
  expect(f.button()!.props.disabled).toBe(false)
  expect(f.reason().props.value).toBe('Owner access adjustment')
  f.click()
  await vi.waitFor(() => expect(f.button()).toBeUndefined())
  expect(f.mutations).toHaveLength(2)
})
