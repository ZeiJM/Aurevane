import {
  GRAND_DISCOVERY_SITES,
  SHADOWS_VIGIL_SCALE,
  type GrandDiscoveryId,
} from './discovery-sites'

/** Footprint of the painted arena perimeter and valley cliffs. */
export function grandDiscoveryBarrier(id: GrandDiscoveryId, x: number, y: number): boolean {
  const site = GRAND_DISCOVERY_SITES.find((item) => item.id === id)
  if (
    !site ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= site.width ||
    y >= site.height
  )
    return false
  if (id === 'remote-colosseum') {
    const dx = (x + 0.5 - site.width / 2) / (site.width * 0.46)
    const dy = (y + 0.5 - site.height * 0.52) / (site.height * 0.4)
    const ring = dx * dx + dy * dy
    // South gate: an authored 5-cell-wide opening in the arena perimeter.
    const gate = Math.abs(x + 0.5 - site.width / 2) <= 2.5 && y >= site.height * 0.61
    return ring > 0.58 && ring <= 1.1 && !gate
  }
  if (id === 'elemental-valley') {
    const edge = Math.min(x, site.width - 1 - x) / SHADOWS_VIGIL_SCALE
    const originalX = x / SHADOWS_VIGIL_SCALE
    const originalY = y / SHADOWS_VIGIL_SCALE
    // Cliff crests form a crescent; the central upper cascade remains water.
    const back = originalY < 4 && (originalX < 26 || originalX > 34)
    const slopes = edge < 3 && originalY < 35
    const southern = originalY >= 36 && edge < 17
    return back || slopes || southern
  }
  return false
}

/** Paint authored masonry and cliffs as rocky ground, preserving the river and lava beds. */
export function structuralTerrainAt(worldX: number, worldY: number, terrain: string): string {
  for (const site of GRAND_DISCOVERY_SITES) {
    if (!grandDiscoveryBarrier(site.id, worldX - site.left, worldY - site.top)) continue
    if (terrain === '.' || terrain === 't' || terrain === '=' || terrain === 'w') return '#'
  }
  return terrain
}
