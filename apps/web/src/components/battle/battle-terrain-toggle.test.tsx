import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BattleTerrainToggle } from './battle-terrain-toggle'
import { BattleMapKey } from './battle-map-key'
import { BATTLE_TERRAIN_KEY_DETAILS } from './battle-terrain-key-presentation'

const snapshot = {
  tactical: {
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [{ position: { x: 0, y: 0 }, terrainId: 'open-ground', elevation: 0 }],
  },
}

describe('footer terrain reader', () => {
  it('starts closed with one keyboard accessible Terrain toggle and no permanent key', () => {
    const markup = renderToStaticMarkup(<BattleTerrainToggle snapshot={snapshot} />)
    expect(markup).toContain('aria-label="Terrain"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).not.toContain('data-battle-terrain-key')
  })

  it('keeps every terrain explanation inside the same reader with native keyboard disclosures', () => {
    const markup = renderToStaticMarkup(<BattleMapKey snapshot={snapshot} compact />)
    expect(markup.match(/<details\b/g)).toHaveLength(6)
    expect(markup.match(/<summary\b/g)).toHaveLength(6)
    expect(markup).not.toContain('data-battle-info-trigger')
    expect(markup).not.toContain('<button')
    expect(markup).toContain('name="battle-terrain-help"')
    for (const terrain of Object.values(BATTLE_TERRAIN_KEY_DETAILS)) {
      expect(markup).toContain(`aria-label="${terrain.name}"`)
      expect(markup).toContain(terrain.description)
    }
  })
})
