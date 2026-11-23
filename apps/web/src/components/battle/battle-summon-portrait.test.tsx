import { beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ failed: null as string | null }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: () => [
    hooks.failed,
    (value: string | null) => {
      hooks.failed = value
    },
  ],
}))
import { BattleSummonPortrait } from './battle-summon-portrait'
beforeEach(() => {
  hooks.failed = null
})
it('renders only finalized public routes and restores the initial if the image becomes unavailable', () => {
  const src = '/api/content-media/00000000-0000-4000-8000-000000000012'
  const image = BattleSummonPortrait({ src, name: 'Verdant Stalker' })
  expect(image.type).toBe('img')
  expect(image.props.src).toBe(src)
  image.props.onError()
  const fallback = BattleSummonPortrait({
    src,
    name: 'Verdant Stalker',
    fallbackClassName: 'initial',
  })
  expect(fallback.props.className).toBe('initial')
  expect(fallback.type).toBe('span')
  expect(fallback.props.children).toBe('V')
})
it.each([
  'https://external.test/image.png',
  'blob:local',
  '/api/master/combat-content/media/00000000-0000-4000-8000-000000000012',
])('never renders a draft or untrusted portrait route: %s', (src) => {
  const fallback = BattleSummonPortrait({ src, name: 'Verdant Stalker' })
  expect(fallback.type).toBe('span')
  expect(fallback.props.children).toBe('V')
})
it('renders the registered moon drake portrait while rejecting arbitrary static paths', () => {
  const src = '/media/art/support/vesper-portrait-v01.webp'
  const image = BattleSummonPortrait({ src, name: 'Vesper' })
  expect(image.type).toBe('img')
  expect(image.props.src).toBe(src)
  expect(BattleSummonPortrait({ src: '/media/art/unregistered.webp', name: 'Vesper' }).type).toBe(
    'span',
  )
})
