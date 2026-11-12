import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells))
      hooks.cells[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      hooks.cells[i],
      (next: unknown) => {
        hooks.cells[i] =
          typeof next === 'function' ? (next as (old: unknown) => unknown)(hooks.cells[i]) : next
      },
    ]
  },
  useEffect() {},
  useRef(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = { current: initial }
    return hooks.cells[i]
  },
}))

import { WorldEnvironmentEditor } from './world-environment-editor'
import { DEFAULT_WORLD_ENVIRONMENT_SETTINGS } from '@/world/environment'
type Props = Record<string, unknown> & { children?: ReactNode }
function all(
  node: ReactNode,
  predicate: (node: ReactElement<Props>) => boolean,
): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((child) => all(child, predicate))
  if (!isValidElement<Props>(node)) return []
  return [...(predicate(node) ? [node] : []), ...all(node.props.children, predicate)]
}
const find = (node: ReactNode, predicate: (node: ReactElement<Props>) => boolean) =>
  all(node, predicate)[0]!
const control = (tree: ReactNode, label: string) =>
  find(
    find(
      tree,
      (node) =>
        node.type === 'label' &&
        Array.isArray(node.props.children) &&
        node.props.children
          .filter((child) => typeof child === 'string' || typeof child === 'number')
          .join('') === label,
    ).props.children,
    (node) => ['select', 'input'].includes(String(node.type)),
  )
const change = (node: ReactElement<Props>, value: string) =>
  (node.props.onChange as (e: unknown) => void)({ currentTarget: { value }, target: { value } })
const renderWith = (fn: () => ReactNode) => () => {
  hooks.index = 0
  return fn()
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
})
afterEach(() => vi.unstubAllGlobals())

it('saves force/keep/return-to-random selections with the current settings version and rejects invalid intervals', async () => {
  let version = 4
  const settings = { ...DEFAULT_WORLD_ENVIRONMENT_SETTINGS, version }
  const request = vi.fn().mockImplementation(() =>
    Promise.resolve(
      Response.json({
        settings: {
          ...settings,
          version: ++version,
          voidRealmOverride: 'glass-tides',
          voidRealmOverrideUntil: 600_000,
        },
      }),
    ),
  )
  vi.stubGlobal('fetch', request)
  const render = renderWith(() =>
    WorldEnvironmentEditor({ initialSettings: settings, initialNowMs: 500_000 }),
  )
  const submit = () =>
    (
      find(render(), (node) => node.type === 'form').props.onSubmit as (
        event: unknown,
      ) => Promise<void>
    )({ preventDefault() {} })
  change(control(render(), 'Map selection'), 'glass-tides')
  change(control(render(), 'Automatic map roll interval (real minutes)'), '5')
  await submit()
  expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({
    expectedVersion: 4,
    change: {
      dayLengthMinutes: 1440,
      weatherRollMinutes: 360,
      warpedShiftMinutes: 5,
      timeOffsetMinutes: 0,
      frozenMinuteOfDay: null,
      weather: 'unchanged',
      voidRealm: 'glass-tides',
    },
  })
  expect(control(render(), 'Map selection').props.value).toBe('unchanged')
  await submit()
  expect(JSON.parse(request.mock.calls[1]![1].body).change).not.toHaveProperty('voidRealm')
  expect(JSON.parse(request.mock.calls[1]![1].body).expectedVersion).toBe(5)
  change(control(render(), 'Map selection'), 'live')
  await submit()
  expect(JSON.parse(request.mock.calls[2]![1].body).change.voidRealm).toBeNull()
  change(control(render(), 'Automatic map roll interval (real minutes)'), '0')
  await submit()
  expect(request).toHaveBeenCalledTimes(3)
})

it('retains the selected map and original version after a failed save so the user can retry', async () => {
  const settings = { ...DEFAULT_WORLD_ENVIRONMENT_SETTINGS, version: 7 }
  const request = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { error: { message: 'Refresh the world environment before changing it.' } },
        { status: 409 },
      ),
    )
  vi.stubGlobal('fetch', request)
  const render = renderWith(() =>
    WorldEnvironmentEditor({ initialSettings: settings, initialNowMs: 500_000 }),
  )
  change(control(render(), 'Map selection'), 'ivory-veil')
  await (
    find(render(), (node) => node.type === 'form').props.onSubmit as (
      event: unknown,
    ) => Promise<void>
  )({ preventDefault() {} })
  expect(control(render(), 'Map selection').props.value).toBe('ivory-veil')
  expect(find(render(), (node) => node.props.role === 'status').props.children).toBe(
    'Refresh the world environment before changing it.',
  )
  expect(JSON.parse(request.mock.calls[0]![1].body).expectedVersion).toBe(7)
})
