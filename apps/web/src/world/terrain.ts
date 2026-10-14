/** Shared collision vocabulary. Foliage is scenery; water/lava/buildings are real obstacles. */
export function terrainWalkable(terrain: string): boolean {
  return terrain === '.' || terrain === '=' || terrain === 's' || terrain === 't'
}

/** Lossless public presentation encoding; collision still uses canonical rows. */
export function encodeTerrainRows(rows: readonly string[]): string {
  const ground = rows.join('')
  const runs =
    ground
      .match(/(.)\1*/g)
      ?.map((run) => `${run.length}${run[0]}`)
      .join('') ?? ''
  return runs.length + 1 < ground.length ? `!${runs}` : ground
}
export function decodeTerrainRows(encoded: string, length: number): string | null {
  if (!encoded.startsWith('!')) return encoded.length === length ? encoded : null
  const runs = encoded.slice(1)
  let cursor = 0,
    ground = ''
  for (const match of runs.matchAll(/(\d+)([^\d])/g)) {
    const count = Number(match[1])
    if (match.index !== cursor || count < 1 || ground.length + count > length) return null
    ground += match[2]!.repeat(count)
    cursor += match[0].length
  }
  return cursor === runs.length && ground.length === length ? ground : null
}
