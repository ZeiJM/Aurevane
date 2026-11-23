import { mainlandSectorAtNumber, mainlandSectorCount } from '@/world/sector-index'
import { MASTER_TELEPORT_GEOMETRY_VERSION } from '@/master/players'
import { isWalkable } from '@/world/travel'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffect() {},
  useState(initial: unknown) {
    const index = hooks.index++
    if (!(index in hooks.cells))
      hooks.cells[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      hooks.cells[index],
      (value: unknown) => {
        hooks.cells[index] = value
      },
    ]
  },
}))
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
})
import { PlayerTeleportForm } from './player-teleport-form'
it('offers mainland or current Void with bounded sector and local coordinate fields', () => {
  const html = renderToStaticMarkup(
    createElement(PlayerTeleportForm, { disabled: false, onReview: () => {} }),
  )
  expect(html).toContain('Current Void')
  expect(html).toContain('Mainland')
  expect(html).toContain('Sector number')
  expect(html).toContain(`max="${mainlandSectorCount()}"`)
  expect(html).toContain('max="12"')
  expect(html).toContain('max="8"')
  expect(html).toContain('Staff reason')
  expect(html).toContain('maxLength="240"')
  expect(html).toContain('Review teleport')
  expect(html).not.toContain('<form')
})

type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (node: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean) ?? null
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
it('updates sector feedback from walkable targets and submits the current chart version', () => {
  const onReview = vi.fn()
  const render = () => {
    hooks.index = 0
    return PlayerTeleportForm({ disabled: false, onReview })
  }
  const numberField = () =>
    find(render(), (node) => node.type === 'input' && node.props.className !== undefined)!
  const set = (field: ReactElement<Props>, value: string) =>
    (field.props.onChange as (event: unknown) => void)({ target: { value } })
  set(numberField(), '99999')
  expect(numberField().props['data-sector-valid']).toBe(false)
  const valid = Array.from({ length: mainlandSectorCount() }, (_, i) => i + 1).find((i) =>
    isWalkable(mainlandSectorAtNumber(i)!, { x: 6, y: 4 }),
  )!
  set(numberField(), String(valid))
  expect(numberField().props['data-sector-valid']).toBe(true)
  set(
    find(render(), (node) => node.type === 'input' && node.props.type === 'text')!,
    ' Reviewed recovery ',
  )
  ;(find(render(), (node) => node.type === 'button')!.props.onClick as () => void)()
  expect(onReview).toHaveBeenCalledWith(
    {
      map: 'mainland',
      sectorNumber: valid,
      x: 6,
      y: 4,
      geometryVersion: MASTER_TELEPORT_GEOMETRY_VERSION,
    },
    'Reviewed recovery',
  )
  const choose = find(render(), (node) => node.type === 'select')!
  set(choose, 'currentVoid')
  expect(numberField().props).toMatchObject({ min: 8193, max: 11264, value: '8193' })
})

it('marks a newly entered Void sector red until the active map validates it', () => {
  const render = () => {
    hooks.index = 0
    return PlayerTeleportForm({
      disabled: false,
      validateVoid: async () => true,
      onReview: () => {},
    })
  }
  const choose = find(render(), (node) => node.type === 'select')!
  ;(choose.props.onChange as (event: unknown) => void)({ target: { value: 'currentVoid' } })
  const sector = find(
    render(),
    (node) => node.type === 'input' && node.props.className !== undefined,
  )!
  expect(sector.props).toMatchObject({ 'data-sector-valid': false, 'aria-busy': true })
  expect(find(render(), (node) => node.type === 'button')!.props.disabled).toBe(true)
})
