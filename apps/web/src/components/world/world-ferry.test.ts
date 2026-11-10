import { expect, it } from 'vitest'
import { ferrymanTopic, ferryStatus, formatFerryCountdown } from './world-ferry'

const dock = { port: 'mainland', nextDepartureAt: 300_000, fareCrowns: 0 } as const
const waiting = {
  ...dock,
  passage: { direction: 'outbound', departureAt: 300_000, arrivalAt: 600_000 },
} as const

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
