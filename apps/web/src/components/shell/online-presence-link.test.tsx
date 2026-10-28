import { createElement, type EffectCallback } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { effects, router } = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  router: { replace: vi.fn() },
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffect: (effect: EffectCallback) => effects.push(effect),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/game/training',
  useRouter: () => router,
}))
vi.mock('next/link', () => ({
  default: ({
    children,
    prefetch,
    ...props
  }: React.ComponentProps<'a'> & { prefetch?: boolean }) => {
    void prefetch
    return createElement('a', props, children)
  },
}))
vi.mock('@/components/battle/pvp-battle-key-input-assist', () => ({
  PvpBattleKeyInputAssist: () => null,
}))
vi.mock('@/media/registry', () => ({
  getImageAsset: () => ({ src: '/world.webp', width: 1600, height: 900 }),
}))

import { AuthenticatedShellPresentation } from './authenticated-shell-presentation'

const cleanups: (() => void)[] = []
let visibility: 'visible' | 'hidden'
let visibilityListeners: Set<() => void>
const fetchPresence = vi.fn()

async function mount(characterId: string | null) {
  const markup = renderToStaticMarkup(
    <AuthenticatedShellPresentation
      layout="battlefield"
      character={characterId ? { id: characterId, name: 'Training adventurer' } : null}
    >
      <p>Training</p>
    </AuthenticatedShellPresentation>,
  )
  for (const effect of effects.splice(0)) {
    const cleanup = effect()
    if (cleanup) cleanups.push(cleanup)
  }
  await vi.advanceTimersByTimeAsync(0)
  return markup
}

beforeEach(() => {
  router.replace.mockReset()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-24T12:00:00Z'))
  visibility = 'visible'
  visibilityListeners = new Set()
  vi.stubGlobal('window', { setInterval, clearInterval, setTimeout, clearTimeout })
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibility
    },
    addEventListener: (event: string, listener: () => void) => {
      if (event === 'visibilitychange') visibilityListeners.add(listener)
    },
    removeEventListener: (_event: string, listener: () => void) =>
      visibilityListeners.delete(listener),
  })
  fetchPresence.mockReset().mockImplementation(async () => Response.json({ count: 3 }))
  vi.stubGlobal('fetch', fetchPresence)
})

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  effects.splice(0)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('selected-character activity with the Account menu closed', () => {
  it('opens the account notice when the authoritative heartbeat reports a ban', async () => {
    fetchPresence.mockResolvedValueOnce(
      Response.json({ error: { code: 'FORBIDDEN', accountBanned: true } }, { status: 403 }),
    )
    await mount('banned-character')
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/account/banned')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchPresence).toHaveBeenCalledTimes(1)
  })
  it('records visible training activity without opening the Account menu', async () => {
    const markup = await mount('closed-menu-character')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).not.toContain('aria-label="Account menu"')
    expect(fetchPresence).toHaveBeenCalledWith('/api/presence', {
      method: 'POST',
      cache: 'no-store',
    })
    await vi.advanceTimersByTimeAsync(60_000)
    await mount('closed-menu-character')
    expect(fetchPresence).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchPresence).toHaveBeenCalledTimes(2)
  })

  it('does not let a previous character or empty roster throttle a new selection', async () => {
    await mount(null)
    expect(fetchPresence).not.toHaveBeenCalled()
    await mount('first-selected-character')
    await mount('second-selected-character')
    expect(fetchPresence).toHaveBeenCalledTimes(2)
  })

  it('shares one pending request across remounts but not across character changes', async () => {
    let resolvePresence!: (response: Response) => void
    fetchPresence.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePresence = resolve
      }),
    )
    await mount('pending-character')
    await mount('pending-character')
    expect(fetchPresence).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBeLessThanOrEqual(1)
    await mount('other-pending-character')
    expect(fetchPresence).toHaveBeenCalledTimes(2)
    resolvePresence(Response.json({ count: 8 }))
    await vi.advanceTimersByTimeAsync(0)
    await mount('other-pending-character')
    expect(fetchPresence).toHaveBeenCalledTimes(2)
  })

  it('skips hidden tabs and records activity on becoming visible', async () => {
    visibility = 'hidden'
    await mount('hidden-character')
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(240_000)
    expect(fetchPresence).not.toHaveBeenCalled()
    visibility = 'visible'
    visibilityListeners.forEach((listener) => listener())
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchPresence).toHaveBeenCalledTimes(1)
  })

  it('backs off failures across remounts instead of retrying on every render', async () => {
    fetchPresence.mockRejectedValue(new Error('Network unavailable'))
    await mount('retry-character')
    await mount('retry-character')
    expect(fetchPresence).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(14_999)
    expect(fetchPresence).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchPresence).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetchPresence).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchPresence).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetchPresence).toHaveBeenCalledTimes(5)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('returns to the normal cadence after recovery and removes the last timer on unmount', async () => {
    fetchPresence.mockResolvedValueOnce(Response.json({ count: -1 }))
    await mount('recovering-character')
    await vi.advanceTimersByTimeAsync(15_000)
    expect(fetchPresence).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(119_999)
    expect(fetchPresence).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchPresence).toHaveBeenCalledTimes(3)
    cleanups.splice(0).forEach((cleanup) => cleanup())
    expect(vi.getTimerCount()).toBe(0)
    expect(visibilityListeners.size).toBe(0)
  })
})
