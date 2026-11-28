import type { CSSProperties } from 'react'
import type { CombatTerrainOverlay } from '@aurevane/game-core/combat/terrain-overlays'

export function battleTerrainSurface(terrainId: string) {
  if (terrainId === 'blocked') return 'blocked'
  if (terrainId.includes('rough') || terrainId.includes('difficult')) return 'rough'
  return 'open'
}

export function BattleTerraceTerrain({
  terrain,
  height,
  overlay,
  position,
}: {
  terrain: ReturnType<typeof battleTerrainSurface>
  height: number
  overlay?: CombatTerrainOverlay['kind']
  position: { x: number; y: number }
}) {
  const relief = terrain === 'blocked' ? 'blocked' : height > 0 ? 'rise' : terrain
  const motionPhase = {
    '--terrain-motion-phase': `-${((position.x * 13 + position.y * 29) % 43) / 10}s`,
  } as CSSProperties
  return (
    <>
      {relief !== 'open' && (
        <span data-terrace-relief={relief} aria-hidden="true" style={motionPhase} />
      )}
      {overlay && <span data-terrace-weather={overlay} aria-hidden="true" style={motionPhase} />}
    </>
  )
}
