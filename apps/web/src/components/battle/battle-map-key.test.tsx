import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BattleMapKey } from './battle-map-key'
import {
  BATTLE_TERRAIN_KEY_DETAILS,
  presentBattleTerrainKeys,
  type BattleTerrainKeySnapshot,
} from './battle-terrain-key-presentation'
import { COMBAT_TERRAIN_OVERLAY_DETAILS } from '@aurevane/game-core/combat/terrain-overlays'

const terrains = [
  { id: 'open-ground', traversalCost: 1 },
  { id: 'rough-ground', traversalCost: 2 },
  { id: 'blocked', traversalCost: null },
]
function board(terrainId = 'open-ground', elevation = 0): BattleTerrainKeySnapshot {
  return {
    tactical: {
      terrains,
      tiles: [{ position: { x: 0, y: 0 }, terrainId, elevation }],
    },
  }
}

function overlay(kind: 'frozen' | 'steam', remainingRoundBoundaries = 2, x = 0) {
  return { kind, position: { x, y: 0 }, remainingRoundBoundaries, sourceCombatantId: 'caster' }
}

describe('live battle terrain key', () => {
  it('includes terrain on tiles and omits unused catalog types and absent elevation', () => {
    expect(presentBattleTerrainKeys(board())).toEqual(['open'])
    expect(presentBattleTerrainKeys(board('rough-ground'))).toEqual(['rough'])
    expect(presentBattleTerrainKeys(board('blocked'))).toEqual(['blocked'])
    expect(presentBattleTerrainKeys(board('rough-ground', 2))).toEqual(['rough', 'elevated'])
    expect(presentBattleTerrainKeys({ tactical: { terrains, tiles: [] } })).toEqual([])
  })

  it('tracks overlay creation, conversion and expiration while preserving base terrain', () => {
    const snapshot = board('rough-ground', 1)
    expect(presentBattleTerrainKeys({ ...snapshot, terrainOverlays: [overlay('frozen')] })).toEqual(
      ['rough', 'elevated', 'frozen'],
    )
    expect(presentBattleTerrainKeys({ ...snapshot, terrainOverlays: [overlay('steam')] })).toEqual([
      'rough',
      'elevated',
      'steam',
    ])
    expect(presentBattleTerrainKeys({ ...snapshot, terrainOverlays: [] })).toEqual([
      'rough',
      'elevated',
    ])
    expect(
      presentBattleTerrainKeys({ ...snapshot, terrainOverlays: [overlay('frozen', 0)] }),
    ).toEqual(['rough', 'elevated'])
    expect(
      presentBattleTerrainKeys({ ...snapshot, terrainOverlays: [overlay('steam', 2, 99)] }),
    ).toEqual(['rough', 'elevated'])
  })

  it('deduplicates live types in a mixed board', () => {
    const snapshot = board()
    snapshot.tactical.tiles = [
      ...snapshot.tactical.tiles,
      { position: { x: 1, y: 0 }, terrainId: 'open-ground', elevation: 1 },
      { position: { x: 2, y: 0 }, terrainId: 'rough-ground', elevation: 0 },
    ]
    expect(
      presentBattleTerrainKeys({
        ...snapshot,
        terrainOverlays: [overlay('frozen'), overlay('steam', 1, 1)],
      }),
    ).toEqual(['open', 'rough', 'elevated', 'frozen', 'steam'])
  })

  it('renders one keyboard-accessible help trigger per present type and no extra key button', () => {
    const markup = renderToStaticMarkup(createElement(BattleMapKey, { snapshot: board() }))
    expect(markup).toContain('aria-label="Terrain Key"')
    expect(markup).toContain('aria-label="Neutral ground"')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup.match(/<button\b/g)).toHaveLength(1)
    expect(markup).not.toContain('Map Key')
    expect(markup).not.toContain('Full terrain key')
    expect(markup).not.toContain('Open ground')
    expect(markup).not.toContain('Frozen')
    expect(markup).not.toContain('Steam')
    const steamMarkup = renderToStaticMarkup(
      createElement(BattleMapKey, {
        snapshot: { ...board(), terrainOverlays: [overlay('steam')] },
      }),
    )
    expect(steamMarkup).toContain('aria-label="Steam"')
    expect(steamMarkup).not.toContain('Frozen')
  })

  it('uses authoritative overlay descriptions and durations', () => {
    for (const kind of ['frozen', 'steam'] as const) {
      expect(BATTLE_TERRAIN_KEY_DETAILS[kind].description).toContain(
        COMBAT_TERRAIN_OVERLAY_DETAILS[kind].description,
      )
      expect(BATTLE_TERRAIN_KEY_DETAILS[kind].description).toContain(
        `${COMBAT_TERRAIN_OVERLAY_DETAILS[kind].roundBoundaries} round boundaries`,
      )
    }
  })
})
