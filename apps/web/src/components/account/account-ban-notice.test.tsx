import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ index: 0, cells: [] as unknown[], replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace }) }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffect() {},
  useState(initial: unknown) {
    const i = state.index++
    if (!(i in state.cells)) state.cells[i] = initial
    return [
      state.cells[i],
      (value: unknown) => {
        state.cells[i] = value
      },
    ]
  },
  useRef(initial: unknown) {
    const i = state.index++
    if (!(i in state.cells)) state.cells[i] = { current: initial }
    return state.cells[i]
  },
}))
import { AccountBanNotice } from './account-ban-notice'
const ban = {
  active: true,
  permanent: false,
  expiresAt: '2026-10-28T12:00:00Z',
  serverTime: '2026-10-28T12:01:00Z',
  reason: '<script>private reason text</script>',
}
type Props = { children?: ReactNode; onClick?(): void }
function find(node: ReactNode): ReactElement<Props> | null {
  if (Array.isArray(node)) return node.map(find).find(Boolean) ?? null
  if (!isValidElement<Props>(node)) return null
  return node.type === 'button' && node.props.onClick ? node : find(node.props.children)
}
beforeEach(() => {
  state.index = 0
  state.cells = []
  state.replace.mockReset()
})
afterEach(() => vi.unstubAllGlobals())
it('keeps access blocked when the displayed countdown reaches zero and escapes the reason', () => {
  const html = renderToStaticMarkup(<AccountBanNotice initialStatus={ban} />)
  expect(html).toContain('expiry has passed')
  expect(html).toContain('&lt;script&gt;')
  expect(html).toContain('action="/auth/signout"')
  expect(state.replace).not.toHaveBeenCalled()
})
it('returns to the game only after a fresh server response says the ban is inactive', async () => {
  const fetchStatus = vi
    .fn()
    .mockResolvedValueOnce(Response.json(ban))
    .mockResolvedValueOnce(Response.json({ ...ban, active: false, expiresAt: null, reason: null }))
  vi.stubGlobal('fetch', fetchStatus)
  const render = () => {
    state.index = 0
    return AccountBanNotice({ initialStatus: ban })
  }
  find(render())!.props.onClick!()
  await vi.waitFor(() => expect(fetchStatus).toHaveBeenCalledOnce())
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(state.replace).not.toHaveBeenCalled()
  find(render())!.props.onClick!()
  await vi.waitFor(() => expect(state.replace).toHaveBeenCalledExactlyOnceWith('/game'))
})
