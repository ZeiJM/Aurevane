import React from 'react'
import { createRoot } from 'react-dom/client'
import {
  BattleGroundAreaLayer,
  battleGroundAreaLabel,
} from '@/components/battle/battle-ground-area-layer'
import { BattleActionPreview } from '@/components/battle/battle-action-preview'
import boardStyles from '@/components/battle/battlefield-presentation-bundle.module.css'
import terrainStyles from '@/components/battle/battle-terrain-presentation-polish.module.css'
import mobileStyles from '@/components/battle/battle-mobile-layout.module.css'

const query = new URLSearchParams(location.search)
const tileSize = innerWidth <= 820 ? 32 : 64
const terrain = Array.from({ length: 48 }, (_, index) => ({
  position: { x: index % 8, y: Math.floor(index / 8) },
  before: null,
  after: 'frozen',
  remainingRoundBoundaries: 2,
  frozenGroundPolicyVersion: 1,
  skillApSurcharge: 10,
}))
if (query.get('scenario') === 'mixed')
  terrain.push(
    ...Array.from({ length: 5 }, (_, x) => ({
      position: { x, y: 1 },
      before: null,
      after: 'steam',
      remainingRoundBoundaries: 3,
      activationRound: 4,
    })),
  )
const preview = {
  kind: 'action',
  legal: true,
  actionId: 'spirit-bomb',
  actorId: 'you',
  primaryCombatantId: null,
  affectedTiles: terrain.map((tile) => tile.position),
  affectedCombatantIds: [],
  projectedEffects: [],
  projectedStatuses: [],
  projectedTerrain: terrain,
  projectedEvents: terrain.map((tile) => ({
    ...tile,
    event: 'terrain_overlay_changed',
    actionId: 'spirit-bomb',
    sourceCombatantId: 'you',
  })),
  mpCost: 0,
  actionEconomyCost: 30,
  actionEconomyBefore: 100,
  actionEconomyAfter: 70,
  hitChanceBasisPoints: null,
  defenseKind: null,
  defenseRating: null,
  mitigatedBaseDamage: null,
  issues: [],
  spendsAction: true,
}
if (query.get('scenario') === 'current') {
  preview.projectedTerrain = []
  preview.projectedEvents = []
  preview.projectedGroundAreas = [
    {
      id: 'current.preview',
      tiles: terrain.map((tile) => tile.position),
      activationRound: 4,
      expiresAtRound: 7,
      visualPresetId: 'frost',
      effectVisualIds: ['status:frozen', 'damage'],
    },
  ]
}
const currentField = {
  id: 'ground.current',
  tiles: [{ x: 2, y: 0 }],
  activationRound: 3,
  expiresAtRound: 6,
  visualPresetId: 'arcane-pulse',
  effectVisualIds: ['damage', 'status:guarded', 'status:frozen'],
}
window.originalGroundPreview = JSON.stringify(preview)
window.currentGroundPreview = preview
createRoot(document.getElementById('root')).render(
  <>
    <main
      data-mode={query.get('mode')}
      style={{
        width: 'min(800px, calc(100vw - 32px))',
        height: 64,
        margin: 16,
        border: '1px solid #b19875',
        boxSizing: 'border-box',
        padding: 4,
      }}
    >
      <BattleActionPreview
        preview={preview}
        pending={false}
        skill={{
          id: 'spirit-bomb',
          name: 'Spirit Bomb',
          apCost: 30,
          mpCost: 0,
          targetKind: query.get('target') || 'unit',
          targetTeamPolicy: 'enemy',
          minimumRange: 0,
          maximumRange: 3,
          tags: [],
          effectDescriptions: [],
          requirementDescriptions: [],
        }}
        targetTile={{ position: { x: 3, y: 3 }, terrainId: 'open', elevation: 0 }}
      />
    </main>
    <div
      className={query.get('mode') === 'spectator' ? undefined : mobileStyles.shell}
      data-battle-mobile-stage="true"
      data-battle-concept={query.get('mode') !== 'spectator' ? 'true' : undefined}
      data-pvp-spectator={query.get('mode') === 'spectator' ? 'true' : undefined}
      style={{ display: 'block', position: 'relative', minHeight: 0, height: 'auto' }}
    >
      <section
        id="battlefield"
        aria-label="Terrain marker fixture"
        style={{ display: 'flex', width: 'max-content', margin: 16, gap: 8 }}
      >
        {['frozen', 'steam'].map((kind, index) => (
          <button
            key={kind}
            type="button"
            data-terrain="open"
            data-terrain-overlay={kind}
            data-elevation="true"
            aria-label={`Tile ${index + 1}, 1; open; elevation 1`}
            style={{
              position: 'relative',
              width: tileSize,
              height: tileSize,
              padding: 0,
              boxSizing: 'border-box',
            }}
          >
            <i data-terrain-overlay-marker="true" aria-hidden="true">
              {kind === 'frozen' ? '❄' : '≋'}2
            </i>
            <span data-terrain-elevation-marker="true" aria-hidden="true">
              ▲1
            </span>
          </button>
        ))}
        {[
          ['pending', 2],
          ['active', 3],
          ['expired', 6],
        ].map(([phase, round]) => (
          <button
            key={phase}
            data-current-ground-phase={phase}
            type="button"
            data-terrain="open"
            aria-label={`Tile 3, 1; open; elevation 1${battleGroundAreaLabel([currentField], round, { x: 2, y: 0 })}`}
            style={{
              position: 'relative',
              width: tileSize,
              height: tileSize,
              padding: 0,
              boxSizing: 'border-box',
            }}
          >
            <BattleGroundAreaLayer areas={[currentField]} round={round} position={{ x: 2, y: 0 }} />
            <span data-terrain-elevation-marker="true" aria-hidden="true">
              ▲1
            </span>
          </button>
        ))}
      </section>
    </div>
    <span className={boardStyles.hook} />
    <span className={terrainStyles.hook} />
  </>,
)
