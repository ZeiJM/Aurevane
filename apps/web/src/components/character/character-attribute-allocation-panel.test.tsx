import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import type { CharacterAttributes } from '@aurevane/game-core/character/creation'
const state = vi.hoisted(() => ({ draft: null as CharacterAttributes | null, reset: false }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => '/game/character',
  useSearchParams: () =>
    new URLSearchParams(state.reset ? 'profilePanel=attributes&attributeMode=reset' : ''),
}))
vi.mock('react', async (original) => {
  const react = await original<typeof import('react')>()
  return {
    ...react,
    useSyncExternalStore: () => true,
    useState: (initial: unknown) =>
      react.useState(
        state.draft && initial && typeof initial === 'object' && 'might' in initial
          ? state.draft
          : initial,
      ),
  }
})
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (children: ReactNode) => children,
}))
import { CharacterAttributeAllocationPanel } from './character-attribute-allocation-panel'
const capped = { might: 10, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 8 }
const base = { might: 7, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 }
function render(attributes = capped, extra = {}) {
  // Portal destination only; no browser behavior is simulated here.
  vi.stubGlobal('document', { body: {} })
  return renderToStaticMarkup(
    createElement(CharacterAttributeAllocationPanel, {
      initialAllocation: {
        characterId: 'character',
        attributes,
        baseAttributes: base,
        level: 3,
        pointPool: 38,
        personalPointPool: 7,
        spentPoints: Object.values(attributes).reduce((a, b) => a + b, 0),
        unspentPoints: 38 - Object.values(attributes).reduce((a, b) => a + b, 0),
        conversionRequired: false,
        resetWindowStartedAt: null,
        resetUsed: 0,
        resetRemaining: 5,
        resetRenewsAt: null,
        serverNow: '2026-10-27T00:00:00Z',
        ...extra,
      },
      focusAttributes: ['might', 'vitality'],
      attributeCaps: capped,
    }),
  )
}
afterEach(() => {
  state.draft = null
  state.reset = false
  vi.unstubAllGlobals()
})
it('does not force or reopen the popup for cap-saturated saved points, including another level-up', () => {
  expect(render()).not.toContain('role="dialog"')
  expect(
    render(capped, { level: 4, pointPool: 39, personalPointPool: 8, unspentPoints: 3 }),
  ).not.toContain('role="dialog"')
})
it('requires spend when another stat has legal room despite one capped stat', () => {
  const html = render({ ...capped, resolve: 7 })
  expect(html).toContain('role="dialog"')
  expect(html).not.toContain('>Close</button>')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Commit Attribute Points<\/button>/)
})
it('permits the last legal point to commit while retaining excess rather than demanding an impossible zero', () => {
  state.draft = capped
  const html = render({ ...capped, resolve: 7 })
  expect(html).toContain('remaining 2 points')
  expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Commit Attribute Points<\/button>/)
})
it('lets a saturated reset close without consuming a reset and permits free conversion', () => {
  state.reset = true
  const html = render()
  expect(html).toContain('>Close</button>')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Confirm Redistribution<\/button>/)
  state.draft = { ...capped, might: 9 }
  expect(render()).toMatch(/<button[^>]*disabled=""[^>]*>Confirm Redistribution<\/button>/)
  state.draft = capped
  state.reset = false
  const conversion = render(capped, { conversionRequired: true })
  expect(conversion).toMatch(/<button(?![^>]*disabled)[^>]*>Confirm Core Stats<\/button>/)
})
