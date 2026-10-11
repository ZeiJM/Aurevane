import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { WorldPlayer } from '@/world/types'
import { WorldDock, sortNearbyPlayers, sortPointsOfInterest } from './world-dock'

const at = { sectorId: 'a', x: 1, y: 1 }
const player = (name: string, level: number, extra: Partial<WorldPlayer> = {}): WorldPlayer => ({
  characterId: name,
  name,
  level,
  portraitRef: 'portrait.test',
  imageUrl: '/p.webp',
  position: at,
  attackable: false,
  ...extra,
})

describe('World dock', () => {
  it('orders online players by level descending, then offline ones', () => {
    const sorted = sortNearbyPlayers([
      player('Low', 3, { online: true }),
      player('Away', 40, { online: false }),
      player('High', 20, { online: true }),
    ])
    expect(sorted.map((p) => p.name)).toEqual(['High', 'Low', 'Away'])
  })
  it('sorts points of interest alphabetically', () => {
    expect(
      sortPointsOfInterest([{ name: 'Watch' }, { name: 'Anchor' }]).map((p) => p.name),
    ).toEqual(['Anchor', 'Watch'])
  })
  it('lists offline characters, labels the zone and only enables Attack when allowed', () => {
    const markup = renderToStaticMarkup(
      createElement(WorldDock, {
        players: [
          player('Sleeper', 5, { online: false }),
          player('Duelist', 9, { online: true, attackable: true }),
        ],
        landmarks: [],
        safe: false,
        selectedPlayerId: null,
        disabled: false,
        onSelectPlayer: () => {},
        onApproach: () => {},
        onAttack: () => {},
        onLandmark: () => {},
      }),
    )
    expect(markup).toContain('PvP zone')
    expect(markup).toContain('Sleeper')
    expect(markup).toContain('Away')
    expect(markup.indexOf('Duelist')).toBeLessThan(markup.indexOf('Sleeper'))
    const attacks = markup.match(/<button[^>]*>Attack<\/button>/g) ?? []
    expect(attacks).toHaveLength(2)
    expect(attacks[0]).not.toContain('disabled')
    expect(attacks[1]).toContain('disabled')
  })
  it('shows a Talk button that cannot be clicked yet', () => {
    const markup = renderToStaticMarkup(
      createElement(WorldDock, {
        players: [player('Chatty', 5, { online: true })],
        landmarks: [],
        safe: true,
        selectedPlayerId: null,
        disabled: false,
        onSelectPlayer: () => {},
        onApproach: () => {},
        onAttack: () => {},
        onLandmark: () => {},
      }),
    )
    const talk = markup.match(/<button[^>]*>Talk<\/button>/)?.[0] ?? ''
    expect(talk).toContain('disabled')
    expect(markup.indexOf('>Attack<')).toBeLessThan(markup.indexOf('>Talk<'))
  })
  it('shows the safe-zone badge', () => {
    const markup = renderToStaticMarkup(
      createElement(WorldDock, {
        players: [],
        landmarks: [],
        safe: true,
        selectedPlayerId: null,
        disabled: false,
        onSelectPlayer: () => {},
        onApproach: () => {},
        onAttack: () => {},
        onLandmark: () => {},
      }),
    )
    expect(markup).toContain('Safe zone')
  })
})
