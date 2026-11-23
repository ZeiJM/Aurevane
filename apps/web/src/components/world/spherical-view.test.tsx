import type { HTMLAttributes, PointerEvent } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

// Exercise the component's real input handlers without starting its renderer.
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => undefined,
  useMemo: (calculate: () => unknown) => calculate(),
  useState: (current: unknown) => [current, vi.fn()],
}))
import { SphericalView } from './spherical-view'

beforeEach(() =>
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  ),
)
afterEach(() => vi.unstubAllGlobals())

function scene() {
  const activate = vi.fn()
  const element = SphericalView({
    src: '/world.webp',
    camera: { longitude: 0, latitude: 0 },
    zoom: 1,
    onCamera: vi.fn(),
    onZoom: vi.fn(),
    onActivate: activate,
  })
  const handlers = element.props as HTMLAttributes<HTMLDivElement>
  const host = {
    setPointerCapture: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
    closest: () => null,
  }
  const town = {
    closest: (selector: string) =>
      selector === 'button' || selector === '[data-globe-town]' ? town : null,
    hasAttribute: (name: string) => name === 'data-globe-town',
  }
  const pointer = (target: unknown, x = 100) =>
    ({
      target,
      currentTarget: host,
      pointerId: 1,
      pointerType: 'mouse',
      clientX: x,
      clientY: 100,
    }) as unknown as PointerEvent<HTMLDivElement>
  return { handlers, host, town, pointer, activate }
}

it('does not select terrain after a town drag returns to its starting point', () => {
  const { handlers, host, town, pointer, activate } = scene()
  handlers.onPointerDown!(pointer(town))
  expect(host.setPointerCapture).not.toHaveBeenCalled()
  handlers.onPointerMove!(pointer(town, 130))
  expect(host.setPointerCapture).toHaveBeenCalledWith(1)
  handlers.onPointerMove!(pointer(host))
  handlers.onPointerUp!(pointer(host))
  expect(activate).not.toHaveBeenCalled()
})

it('keeps ordinary terrain clicks and town button clicks distinct', () => {
  const { handlers, host, town, pointer, activate } = scene()
  handlers.onPointerDown!(pointer(host))
  handlers.onPointerUp!(pointer(host))
  expect(activate).toHaveBeenCalledTimes(1)
  activate.mockClear()
  handlers.onPointerDown!(pointer(town))
  handlers.onPointerUp!(pointer(town))
  expect(activate).not.toHaveBeenCalled()
})
