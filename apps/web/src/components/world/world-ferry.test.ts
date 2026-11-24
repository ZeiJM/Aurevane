import { expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FERRY_MAINLAND_DOCK, FERRYMAN_DECK_POSITION } from '@/world/ferry'
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
    /<button[^>]+aria-label="Ferry Terminal\. Talk to Krane \(Ferryman\)"[^>]*>.*Ferry Terminal.*Next departure in.*10:00.*<\/button>/,
  )
  const underway = render(waiting, 360_000)
  expect(underway).toMatch(/aria-label="Ferry crossing\. Talk to Krane \(Ferryman\)"/)
  expect(underway).toContain('Underway')
  expect(underway).toContain('4:00')
})

it('offers buying throughout the long countdown and boarding only with the right ticket', () => {
  expect(ferrymanTopic(dock, 1)?.speaker).toBe('Krane (Ferryman)')
  expect(ferryStatus(dock, 1).action).toBe('buy-ferry-boarding')
  const ticket = { direction: 'outbound', departureAt: 300_000, canBoard: true } as const
  expect(ferryStatus({ ...dock, ticket }, 1)).toMatchObject({
    label: 'Boarding booked · departs in',
    at: ticket.departureAt,
    action: 'board-ferry',
  })
  const away = { ...dock, port: null, ticket: { ...ticket, canBoard: false } }
  expect(ferryStatus(away, 1)).toMatchObject({ at: ticket.departureAt, action: null })
  expect(ferrymanTopic(away, 1)).toBeNull()
  expect(ferryStatus(away, ticket.departureAt)).toMatchObject({ at: null, action: null })
  expect(ferryStatus({ ...dock, ticket }, ticket.departureAt).action).toBeNull()
})

it('offers disembark only while waiting and distinguishes underway from arrival', () => {
  expect(ferryStatus(waiting, 299_999)).toMatchObject({ action: 'leave-ferry', at: 300_000 })
  expect(ferryStatus(waiting, 300_000)).toMatchObject({ action: null, at: 600_000 })
  expect(ferrymanTopic(waiting, 300_000)?.body).toContain('underway')
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
    name: 'Krane (Ferryman)',
    interactionRadius: 1,
    position: { ...FERRY_MAINLAND_DOCK, x: FERRY_MAINLAND_DOCK.x - 1 },
  }
  expect(worldViewWithFerryman(view).npcs).toEqual([expect.objectContaining(npc)])
  expect(worldViewWithFerryman({ ...view, ferry: dock }).npcs).toEqual([
    expect.objectContaining(npc),
  ])
  expect(worldViewWithFerryman({ ...view, sectors: [] }).npcs).toBeUndefined()
})

it('puts the same talkable Ferryman on the ship deck before and during the crossing', () => {
  const departureAt = 1_800_000_000_000
  const arrivalAt = departureAt + 300_000
  const sectorId = `ferry:outbound:${departureAt}`
  const position = { sectorId, x: 6, y: 4 }
  const ferry = { direction: 'outbound' as const, departureAt, arrivalAt, warpedPhase: null }
  const aboard = worldViewWithFerryman(
    projectWorld({ ...newWorldState(), position, ferry }, [], departureAt),
  )
  expect(aboard.npcs).toContainEqual(
    expect.objectContaining({
      name: 'Krane (Ferryman)',
      position: { ...FERRYMAN_DECK_POSITION, sectorId },
    }),
  )
  expect(ferrymanTopic(aboard.ferry, departureAt - 1)?.body).toContain('reboard')
  expect(ferrymanTopic(aboard.ferry, arrivalAt - 1)?.body).toContain('underway')
})

it('gives each ferry service a distinct named crew member and matching motion appearance', () => {
  const ports = ['mainland', 'north-shore', 'asterwake', 'uncharted'] as const
  const crew = ports.map((port) => ferrymanTopic({ ...dock, port }, 0)!)
  expect(new Set(crew.map((person) => person.speaker)).size).toBe(4)
  expect(new Set(crew.map((person) => person.portraitUrl)).size).toBe(4)
  expect(crew.every((person) => person.speaker.endsWith(' (Ferryman)'))).toBe(true)
})
