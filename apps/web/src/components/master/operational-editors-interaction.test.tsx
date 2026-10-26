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

import { CombatEffectTimingEditor } from './combat-content/combat-effect-timing-editor'
import { BattlefieldElevationEditor } from './combat-content/battlefield-elevation-editor'
import { WorldEnvironmentEditor } from './world-environment/world-environment-editor'
import { DEFAULT_WORLD_ENVIRONMENT_SETTINGS } from '@/world/environment'
import {
  combatEffectTimingMode,
  type CombatEffectTimingPolicy,
} from '@aurevane/game-core/combat/combat-effect-timing'
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
it('sorts timing display in both directions, filters/searches, and saves the unchanged authoritative policy', async () => {
  const policy: CombatEffectTimingPolicy = {
    version: 8,
    tagAuthority: 'global',
    modes: { damage: 'instant', slow: 'controlled', root: 'delayed' },
  }
  const before = JSON.stringify(policy)
  const request = vi.fn().mockResolvedValue(Response.json({ policy: { ...policy, version: 9 } }))
  vi.stubGlobal('fetch', request)
  const render = renderWith(() => CombatEffectTimingEditor({ initialPolicy: policy }))
  change(control(render(), 'Sort effect tags'), 'timing-asc')
  const modes = () =>
    all(
      render(),
      (node) => node.type === 'select' && String(node.props.id).startsWith('timing-'),
    ).map((node) => String(node.props.value))
  const order = ['instant', 'next-round', 'delayed', 'controlled']
  expect(modes().map((mode) => order.indexOf(mode))).toEqual(
    [...modes().map((mode) => order.indexOf(mode))].sort((a, b) => a - b),
  )
  change(control(render(), 'Sort effect tags'), 'timing-desc')
  expect(modes()[0]).toBe('controlled')
  expect(modes().at(-1)).toBe('instant')
  change(control(render(), 'Filter timing'), 'controlled')
  expect(modes()).toEqual(['controlled'])
  change(control(render(), 'Search effect tags'), 'nothing matches')
  expect(modes()).toEqual([])
  await (
    find(render(), (node) => node.type === 'form').props.onSubmit as (e: unknown) => Promise<void>
  )({ preventDefault() {} })
  expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({ policy })
  expect(JSON.stringify(policy)).toBe(before)
  expect(combatEffectTimingMode(policy, 'root')).toBe('delayed')
})
it('saves elevation without reason while retaining the exact concurrency version', async () => {
  const policy = {
    version: 7,
    level1BasisPoints: 6000,
    level2BasisPoints: 3000,
    level3BasisPoints: 1000,
  }
  const request = vi.fn().mockResolvedValue(Response.json({ policy: { ...policy, version: 8 } }))
  vi.stubGlobal('fetch', request)
  const render = renderWith(() => BattlefieldElevationEditor({ initialPolicy: policy }))
  await (
    find(render(), (node) => node.type === 'form').props.onSubmit as (e: unknown) => Promise<void>
  )({ preventDefault() {} })
  expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({
    policy: { ...policy, model: 'independent-highest' },
  })
})
it('submits manual weather minutes and cycle without reason or history and preserves keep-current choice', async () => {
  const settings = { ...DEFAULT_WORLD_ENVIRONMENT_SETTINGS, version: 4 }
  const request = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(Response.json({ settings: { ...settings, version: 5 } })),
    )
  vi.stubGlobal('fetch', request)
  const render = renderWith(() =>
    WorldEnvironmentEditor({ initialSettings: settings, initialNowMs: 0 }),
  )
  change(control(render(), 'Day length (real minutes)'), '120')
  change(control(render(), 'Automatic weather roll interval (real minutes)'), '15')
  change(control(render(), 'Weather selection'), 'storm')
  change(control(render(), 'Forced weather duration (minutes)'), '37')
  const submit = () =>
    (
      find(render(), (node) => node.type === 'form').props.onSubmit as (e: unknown) => Promise<void>
    )({ preventDefault() {} })
  await submit()
  expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({
    expectedVersion: 4,
    change: {
      dayLengthMinutes: 120,
      weatherRollMinutes: 15,
      timeOffsetMinutes: 0,
      frozenMinuteOfDay: null,
      weather: 'storm',
      durationMinutes: 37,
    },
  })
  await submit()
  expect(JSON.parse(request.mock.calls[1]![1].body).change.weather).toBe('unchanged')
  expect(JSON.parse(request.mock.calls[1]![1].body).expectedVersion).toBe(5)
  change(control(render(), 'Weather selection'), 'rain')
  change(control(render(), 'Forced weather duration (minutes)'), '0')
  await submit()
  expect(request).toHaveBeenCalledTimes(2)
})

it('submits independent elevation chances without a total and retains edits after stale failure', async () => {
  const policy = {
    version: 7,
    level1BasisPoints: 6000,
    level2BasisPoints: 3000,
    level3BasisPoints: 1000,
  }
  const request = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { error: { message: 'Refresh elevation settings before saving again.' } },
        { status: 409 },
      ),
    )
  vi.stubGlobal('fetch', request)
  const render = renderWith(() => BattlefieldElevationEditor({ initialPolicy: policy }))
  for (const level of [1, 2, 3])
    change(control(render(), `Elevation level ${level} chance (%)`), '100')
  await (
    find(render(), (node) => node.type === 'form').props.onSubmit as (e: unknown) => Promise<void>
  )({ preventDefault() {} })
  expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({
    policy: {
      version: 7,
      model: 'independent-highest',
      level1BasisPoints: 10000,
      level2BasisPoints: 10000,
      level3BasisPoints: 10000,
    },
  })
  expect(control(render(), 'Elevation level 1 chance (%)').props.value).toBe('100')
  expect(find(render(), (node) => node.props.role === 'status').props.children).toContain(
    'Refresh elevation settings',
  )
})
