import { GRAND_DISCOVERY_SITES, type GrandDiscoveryId } from './discovery-sites'

/**
 * Static public movement geometry matching the art's defended wall/cliff silhouette.
 * This never changes roads, existing water, town squares, or saved IDs. Explicit
 * openings lead into the arena and its scenic valley instead of allowing players
 * to walk through solid surrounding cliffs.
 */
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
    const edge = Math.min(x, site.width - 1 - x)
    // Cliff crests form a crescent; the central upper cascade remains water.
    const back = y < 4 && (x < 26 || x > 34)
    const slopes = edge < 3 && y < site.height - 5
    const southern = y >= site.height - 4 && edge < 17
    return back || slopes || southern
  }
  return false
}

/** Only the previously walkable dry floor may become structural wall. Roads
 * and water keep their canonical traffic and drainage contracts. */
export function structuralTerrainAt(worldX: number, worldY: number, terrain: string): string {
  if (terrain !== '.' && terrain !== 't') return terrain
  for (const site of GRAND_DISCOVERY_SITES) {
    if (grandDiscoveryBarrier(site.id, worldX - site.left, worldY - site.top)) return '#'
  }
  return terrain
}
