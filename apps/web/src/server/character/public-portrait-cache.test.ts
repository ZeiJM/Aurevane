import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('./character-profile-display-service', () => ({
  loadPublicCharacterProfileImageMap: vi.fn(),
}))
import { loadPublicCharacterProfileImageMap } from './character-profile-display-service'
import {
  invalidatePublicPeerPortrait,
  publicPeerPortraits,
  resetPublicPeerPortraits,
} from './public-portrait-cache'

const read = vi.mocked(loadPublicCharacterProfileImageMap)
beforeEach(() => {
  resetPublicPeerPortraits()
  read.mockReset().mockImplementation(async (ids) => new Map(ids.map((id) => [id, id + '.svg'])))
})
afterEach(() => vi.useRealTimers())

it('shares in-flight lookups across overlapping peer scenes, returning only each authorized roster', async () => {
  let finish!: (images: Map<string, string>) => void
  read.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const one = publicPeerPortraits(['Ada', 'Bea'])
  const two = publicPeerPortraits(['Bea', 'Cleo'])
  expect(read.mock.calls).toEqual([[['Ada', 'Bea']], [['Cleo']]])
  finish(
    new Map([
      ['Ada', 'Ada.svg'],
      ['Bea', 'Bea.svg'],
      ['Other', 'Other.svg'],
    ]),
  )
  expect(await one).toEqual(
    new Map([
      ['Ada', 'Ada.svg'],
      ['Bea', 'Bea.svg'],
    ]),
  )
  expect(await two).toEqual(
    new Map([
      ['Bea', 'Bea.svg'],
      ['Cleo', 'Cleo.svg'],
    ]),
  )
  expect((await publicPeerPortraits(['Cleo', 'Ada'])).size).toBe(2)
  expect(read).toHaveBeenCalledTimes(2)
})

it('caches missing published portraits for thirty seconds and retries failures immediately', async () => {
  vi.useFakeTimers()
  read.mockRejectedValueOnce(new Error('temporarily unavailable')).mockResolvedValueOnce(new Map())
  expect((await publicPeerPortraits(['Ada'])).get('Ada')).toBeUndefined()
  expect((await publicPeerPortraits(['Ada'])).get('Ada')).toBeUndefined()
  vi.advanceTimersByTime(29_999)
  expect((await publicPeerPortraits(['Ada'])).get('Ada')).toBeUndefined()
  expect(read).toHaveBeenCalledTimes(2)
  vi.advanceTimersByTime(1)
  expect((await publicPeerPortraits(['Ada'])).get('Ada')).toBe('Ada.svg')
  expect(read).toHaveBeenCalledTimes(3)
})

it('invalidates committed public looks and prevents an older failed read from evicting the replacement', async () => {
  let fail!: (reason: Error) => void
  read.mockReturnValueOnce(
    new Promise((_, reject) => {
      fail = reject
    }),
  )
  const first = publicPeerPortraits(['Ada'])
  invalidatePublicPeerPortrait('Ada')
  expect((await publicPeerPortraits(['Ada'])).get('Ada')).toBe('Ada.svg')
  fail(new Error('stale'))
  await first
  expect((await publicPeerPortraits(['Ada'])).get('Ada')).toBe('Ada.svg')
  expect(read).toHaveBeenCalledTimes(2)
})

it('evicts least recently observed characters under sustained arrivals', async () => {
  const ids = Array.from({ length: 2048 }, (_, i) => 'peer-' + i)
  for (let start = 0; start < ids.length; start += 200)
    await publicPeerPortraits(ids.slice(start, start + 200))
  await publicPeerPortraits(['peer-0'])
  await publicPeerPortraits(['newcomer'])
  read.mockClear()
  await publicPeerPortraits(['peer-0', 'peer-1', 'newcomer'])
  expect(read).toHaveBeenCalledExactlyOnceWith(['peer-1'])
})
