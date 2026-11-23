import { expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FERRY_MAINLAND_DOCK, FERRYMAN_SPRITE } from '@/world/ferry'
import { newWorldState } from '@/world/travel'
import { projectWorld } from '@/server/world/world-service'
import {
  ferrymanTopic,
  ferryStatus,
  formatFerryCountdown,
  worldViewWithFerryman,
  WorldFerryStation,
} from './world-ferry'

vi.mock('server-only', () => ({}))

const dock = { port: 'mainland', nextDepartureAt: 300_000, fareCrowns: 0 } as const
const waiting = {
  ...dock,
  passage: { direction: 'outbound', departureAt: 300_000, arrivalAt: 600_000 },
} as const

it('uses the whole ferry card as the conversation button and keeps underway status readable', () => {
  const render = (ferry: Parameters<typeof WorldFerryStation>[0]['ferry'], serverNow: number) =>
    renderToStaticMarkup(
      createElement(WorldFerryStation, {
        ferry,
        serverNow,
        disabled: false,
        onTalk: vi.fn(),
      }),
    )
  const station = render({ ...dock, nextDepartureAt: 600_000 }, 0)
  expect(station.match(/<button\b/g)).toHaveLength(1)
  expect(station).toMatch(
    /<button[^>]+aria-label="Ferry Terminal\. Talk to Ferryman"[^>]*>.*Ferry Terminal.*Boarding opens in.*5:00.*<\/button>/,
  )
  const underway = render(waiting, 360_000)
  expect(underway).not.toContain('<button')
  expect(underway).toContain('Underway')
  expect(underway).toContain('4:00')
})

it('exposes boarding only from the server-reported port', () => {
  expect(ferrymanTopic(dock, 1)?.speaker).toBe('Ferryman')
  expect(ferryStatus(dock, 1).action).toBe('board-ferry')
  expect(ferryStatus({ ...dock, nextDepartureAt: 500_000 }, 1)).toMatchObject({
    label: 'Boarding opens in',
    at: 200_000,
    action: null,
  })
  expect(ferryStatus(dock, 300_000).action).toBeNull()
  expect(ferrymanTopic({ ...dock, port: null }, 1)).toBeNull()
})

it('offers disembark only while waiting and distinguishes underway from arrival', () => {
  expect(ferryStatus(waiting, 299_999)).toMatchObject({ action: 'leave-ferry', at: 300_000 })
  expect(ferryStatus(waiting, 300_000)).toMatchObject({ action: null, at: 600_000 })
  expect(ferrymanTopic(waiting, 300_000)).toBeNull()
  expect(ferryStatus(waiting, 600_000)).toMatchObject({
    action: null,
    at: null,
    label: 'Arriving…',
  })
  expect(formatFerryCountdown(600_000, 300_000)).toBe('5:00')
  expect(formatFerryCountdown(600_000, 599_999)).toBe('0:01')
})

it('keeps the Ferryman at the same surveyed dock when movement clears boarding eligibility', () => {
  const position = { ...FERRY_MAINLAND_DOCK, y: FERRY_MAINLAND_DOCK.y - 2 }
  const view = projectWorld({ ...newWorldState(), position }, [], 60_000)
  expect(view.ferry).toBeUndefined()
  const npc = {
    name: 'Ferryman',
    spriteUrl: FERRYMAN_SPRITE,
    position: { ...FERRY_MAINLAND_DOCK, x: FERRY_MAINLAND_DOCK.x - 1 },
  }
  expect(worldViewWithFerryman(view).npcs).toEqual([expect.objectContaining(npc)])
  expect(worldViewWithFerryman({ ...view, ferry: dock }).npcs).toEqual([
    expect.objectContaining(npc),
  ])
  expect(worldViewWithFerryman({ ...view, sectors: [] }).npcs).toBeUndefined()
})
