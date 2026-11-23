import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { buildBattleLogView } from './battle-log-service'
import { BattleLogFeed } from '../../components/battle/battle-log-feed'
import { formatBattleLogForClipboard } from '../../components/battle/battle-log-clipboard'

it.each(['push', 'pull'])('describes a failed %s without technical details', (direction) => {
  const view = buildBattleLogView('failed-displacement', [
    {
      event: {
        event: 'displacement_failed',
        actionId: 'spirit-bomb',
        sourceCombatantId: 'zei',
        combatantId: 'recruit',
        direction,
        reason: 'occupied-tile',
        position: { x: 8, y: 4 },
      },
      eventIndex: 0,
      battleVersion: 2,
      createdAt: '2026-11-01T00:00:00Z',
    },
  ])
  const options = { combatantNames: { zei: 'Zei', recruit: 'Recruit' } }
  for (const text of [
    renderToStaticMarkup(<BattleLogFeed entries={view.entries} {...options} />),
    formatBattleLogForClipboard(view.entries, options),
  ]) {
    expect(text).toContain('Recruit was not displaced.')
    expect(text).not.toMatch(/occupied|normal action costs|no refund|\d+,\d+/)
  }
})

it.each([
  { direction: 'pull', distance: 3, verb: 'pulled' },
  { direction: 'push', distance: 5, verb: 'pushed' },
  { direction: 'pull', distance: 1, verb: 'pulled' },
])('describes actual $direction distance without coordinates or resource notes', (fixture) => {
  const event = {
    event: 'combatant_displaced',
    actionId: 'spirit-bomb',
    sourceCombatantId: 'zei',
    combatantId: 'recruit',
    direction: fixture.direction,
    distance: fixture.distance,
    requestedDistance: 15,
    from: { x: 8, y: 4 },
    to: { x: 8 - fixture.distance, y: 4 },
  }
  const original = structuredClone(event)
  const view = buildBattleLogView('displacement-log', [
    {
      event,
      eventIndex: 0,
      battleVersion: 2,
      createdAt: '2026-11-01T00:00:00Z',
    },
  ])
  const options = { combatantNames: { zei: 'Zei', recruit: 'Recruit' } }
  const expected = `Recruit was ${fixture.verb} ${fixture.distance} ${fixture.distance === 1 ? 'tile' : 'tiles'}`
  for (const text of [
    renderToStaticMarkup(<BattleLogFeed entries={view.entries} {...options} />),
    formatBattleLogForClipboard(view.entries, options),
  ]) {
    expect(text).toContain(expected)
    expect(text).not.toMatch(/8,4|→|AP and Movement|15 tiles/)
  }
  expect(view.entries[0]?.headline).toBe(fixture.direction === 'pull' ? 'Pull' : 'Push')
  expect(event).toEqual(original)
})
