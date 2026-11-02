import React from 'react'
import { createRoot } from 'react-dom/client'
import { COMBAT_GROUND_VISUAL_PRESETS } from '@aurevane/game-core/combat/combat-ground-visuals'
import {
  BattleGroundAreaLayer,
  battleGroundAreaLabel,
} from '@/components/battle/battle-ground-area-layer'

const mode = new URLSearchParams(location.search).get('mode') || 'pve'
const tileSize = innerWidth <= 820 ? 32 : 64
const tile = { x: 1, y: 1 }
const area = {
  id: 'ground.fixture',
  tiles: [tile],
  activationRound: 2,
  expiresAtRound: 5,
  visualPresetId: 'embers',
  effectVisualIds: ['damage', 'status:frozen'],
}
window.groundTileClicks = 0
function Tile({ areas, round = 2, steam = false, name }) {
  return (
    <button
      type="button"
      data-terrain="open"
      data-case={name}
      onClick={() => window.groundTileClicks++}
      aria-label={`${name}${battleGroundAreaLabel(areas, round, tile)}`}
      style={{
        position: 'relative',
        display: 'block',
        flexShrink: 0,
        width: tileSize,
        height: tileSize,
        padding: 0,
        border: '1px solid #6d745e',
        borderRadius: 3,
        background: '#293526',
        color: '#e9dec3',
      }}
    >
      <BattleGroundAreaLayer areas={areas} round={round} position={tile} steam={steam} />
      <span
        data-token="true"
        style={{
          position: 'absolute',
          left: tileSize * 0.375,
          top: tileSize * 0.25,
          zIndex: 4,
          width: tileSize * 0.235,
          height: tileSize * 0.344,
          borderRadius: '50% 50% 30% 30%',
          background: '#ded0b1',
          boxShadow: '0 1px 3px #000',
        }}
      />
    </button>
  )
}
createRoot(document.getElementById('root')).render(
  <section
    id="battlefield"
    data-mode={mode}
    style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}
  >
    <h1 style={{ font: '22px Georgia', margin: '0 0 8px' }}>Ground animation palette</h1>
    <p style={{ font: '13px Arial', margin: '0 0 16px', color: '#b9b19f' }}>
      Same Damage and Chilled effects; each field keeps its authored animation.
    </p>
    <section
      aria-label="All Ground presets"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(132px,1fr))',
        gap: 14,
      }}
    >
      {COMBAT_GROUND_VISUAL_PRESETS.map((preset) => (
        <div key={preset.id} data-preset-card={preset.id}>
          <div style={{ font: '13px Arial', marginBottom: 7 }}>{preset.label}</div>
          <div style={{ display: 'flex', gap: 3 }}>
            <Tile
              name={`current-${preset.id}`}
              areas={[{ ...area, id: `current-${preset.id}`, visualPresetId: preset.id }]}
            />
            <Tile
              name={`historical-${preset.id}`}
              areas={[
                {
                  ...area,
                  id: `historical-${preset.id}`,
                  effectVisualIds: undefined,
                  visualPresetId: preset.id,
                },
              ]}
            />
          </div>
        </div>
      ))}
    </section>
    <section aria-label="Ground lifetime cases" style={{ display: 'flex', gap: 12, marginTop: 20 }}>
      <Tile name="pending" round={1} areas={[{ ...area, visualPresetId: 'water' }]} />
      <Tile name="expired" round={5} areas={[area]} />
      <Tile
        name="overlap"
        areas={[area, { ...area, id: 'other', expiresAtRound: 7, visualPresetId: 'water' }]}
      />
      <Tile name="steam" steam areas={[{ ...area, steamTiles: [tile] }]} />
    </section>
  </section>,
)
