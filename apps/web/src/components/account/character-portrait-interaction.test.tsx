import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[], refresh: vi.fn() }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
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
  useRef(initial: unknown) {
    const index = hooks.index++
    if (!(index in hooks.cells)) hooks.cells[index] = { current: initial }
    return hooks.cells[index]
  },
  useMemo(factory: () => unknown) {
    return factory()
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: hooks.refresh }) }))
import { CharacterTitleSettings } from './character-title-settings'

type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (element: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean) ?? null
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
function fixture() {
  const request = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', request)
  const render = () => {
    hooks.index = 0
    return CharacterTitleSettings({
      characterId: 'character-01',
      characterName: 'Elara',
      disciplineName: 'Cinder',
      personalTitle: null,
      personalTitleSetAt: null,
      imageUrl: 'https://images.example.com/custom.webp',
      portraitRef: 'portrait.adventure.male-01',
      portraitChoiceAvailable: true,
      portraitChoiceUsedAt: '2026-10-03T00:00:00Z',
    })
  }
  const control = (label: string) =>
    find(render(), (element) => element.props['aria-label'] === label)!
  const button = () =>
    find(
      render(),
      (element) =>
        element.type === 'button' &&
        ['Confirm Default Portrait', 'Saving…'].includes(element.props.children as string),
    )!
  const choose = (label: string) => (control(label).props.onChange as () => void)()
  const confirm = () => (button().props.onClick as () => void)()
  const status = () =>
    find(
      find(render(), (element) => element.type === 'footer')!,
      (element) => element.props.role === 'status',
    )!.props.children
  return { request, render, control, button, choose, confirm, status }
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  hooks.refresh.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

it('accepts idempotent receipts without timestamps and permits another explicitly confirmed choice', async () => {
  const f = fixture()
  expect(f.button().props.disabled).toBe(true)
  f.confirm()
  expect(f.request).not.toHaveBeenCalled()
  f.choose('Male adventurer 01')
  f.request.mockResolvedValueOnce(
    Response.json({ choice: { portraitRef: 'portrait.adventure.male-01', changedAt: null } }),
  )
  f.confirm()
  await vi.waitFor(() => expect(f.status()).toBe('Default portrait changed.'))
  expect(hooks.refresh).toHaveBeenCalledTimes(1)
  expect(f.control('Male adventurer 01').props.disabled).not.toBe(true)
  expect(f.button().props.disabled).toBe(true)
  f.choose('Female adventurer 02')
  f.request.mockResolvedValueOnce(
    Response.json({
      choice: { portraitRef: 'portrait.adventure.female-02', changedAt: '2026-10-29T00:00:00Z' },
    }),
  )
  f.confirm()
  await vi.waitFor(() => expect(hooks.refresh).toHaveBeenCalledTimes(2))
  expect(f.request.mock.calls.map(([, options]) => JSON.parse(options!.body as string))).toEqual([
    { characterId: 'character-01', portraitRef: 'portrait.adventure.male-01' },
    { characterId: 'character-01', portraitRef: 'portrait.adventure.female-02' },
  ])
  expect(f.status()).toBe('Default portrait changed.')
})

it('keeps the selected draft on a mismatched server receipt and allows retry without changing current artwork', async () => {
  const f = fixture()
  f.choose('Female adventurer 02')
  f.request.mockResolvedValueOnce(
    Response.json({
      choice: { portraitRef: 'portrait.adventure.male-03', changedAt: '2026-10-29' },
    }),
  )
  f.confirm()
  await vi.waitFor(() => expect(f.status()).toBe('The portrait change could not be confirmed.'))
  expect(hooks.refresh).not.toHaveBeenCalled()
  expect(f.control('Female adventurer 02').props.checked).toBe(true)
  expect(f.button().props.disabled).toBe(false)
  const current = find(
    f.render(),
    (element) =>
      element.type === 'span' &&
      Array.isArray(element.props.children) &&
      element.props.children.join('') === 'Male adventurer 01 (current)',
  )
  expect(current).not.toBeNull()
})

it('submits once while saving and prevents dismissal until the request settles', async () => {
  const f = fixture()
  let complete!: (response: Response) => void
  f.request.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        complete = resolve
      }),
  )
  f.choose('Female adventurer 02')
  const confirm = f.button().props.onClick as () => void
  confirm()
  confirm()
  expect(f.request).toHaveBeenCalledTimes(1)
  expect(f.button().props.disabled).toBe(true)
  const cancel = vi.fn()
  const dialog = find(f.render(), (element) => element.type === 'dialog')!
  ;(dialog.props.onCancel as (event: { preventDefault(): void }) => void)({
    preventDefault: cancel,
  })
  expect(cancel).toHaveBeenCalledOnce()
  complete(Response.json({ error: { message: 'Try again.' } }, { status: 503 }))
  await vi.waitFor(() => expect(f.status()).toBe('Try again.'))
  cancel.mockClear()
  ;(
    find(f.render(), (element) => element.type === 'dialog')!.props.onCancel as (event: {
      preventDefault(): void
    }) => void
  )({ preventDefault: cancel })
  expect(cancel).not.toHaveBeenCalled()
})
