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
}: {
  terrain: ReturnType<typeof battleTerrainSurface>
  height: number
  overlay?: CombatTerrainOverlay['kind']
}) {
  const relief = terrain === 'blocked' ? 'blocked' : height > 0 ? 'rise' : terrain
  return (
    <>
      {relief !== 'open' && <span data-terrace-relief={relief} aria-hidden="true" />}
      {overlay && <span data-terrace-weather={overlay} aria-hidden="true" />}
    </>
  )
}
