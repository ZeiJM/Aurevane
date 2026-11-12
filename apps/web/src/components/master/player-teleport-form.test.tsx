import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
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
  expect(html).toContain('max="8192"')
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
it('adds the current coordinate version to reviewed Void destinations without displaying it', () => {
  const onReview = vi.fn()
  const render = () => {
    hooks.index = 0
    return PlayerTeleportForm({ disabled: false, onReview })
  }
  const choose = find(render(), (node) => node.type === 'select')!
  ;(choose.props.onChange as (event: unknown) => void)({ target: { value: 'currentVoid' } })
  const sector = find(render(), (node) => node.type === 'input' && node.props.max === 3072)!
  ;(sector.props.onChange as (event: unknown) => void)({ target: { value: '34' } })
  const reason = find(render(), (node) => node.type === 'input' && node.props.type === 'text')!
  ;(reason.props.onChange as (event: unknown) => void)({ target: { value: ' Reviewed recovery ' } })
  const button = find(render(), (node) => node.type === 'button')!
  ;(button.props.onClick as () => void)()
  expect(onReview).toHaveBeenCalledWith(
    { map: 'currentVoid', sectorNumber: 34, x: 6, y: 4, geometryVersion: '2026-11-12-v2' },
    'Reviewed recovery',
  )
  expect(renderToStaticMarkup(render())).not.toContain('2026-11-12-v2')
})
