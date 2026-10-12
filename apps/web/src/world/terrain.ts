/** Shared collision vocabulary. Foliage is scenery; water/lava/buildings are real obstacles. */
export function terrainWalkable(terrain: string): boolean {
  return terrain === '.' || terrain === '=' || terrain === 's' || terrain === 't'
}
