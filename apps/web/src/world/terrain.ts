/** Every authored dry surface is traversable, including rock and building footprints. */
export function terrainWalkable(terrain: string | undefined): boolean {
  return (
    terrain === '.' ||
    terrain === '=' ||
    terrain === 's' ||
    terrain === 't' ||
    terrain === '#' ||
    terrain === 'b'
  )
}

/** Keep building approaches and landmark art clear of existing rock or architecture. */
export function openScenerySurface(terrain: string | undefined): boolean {
  return terrain === '.' || terrain === '=' || terrain === 's' || terrain === 't' || terrain === 'w'
}

const dryTownSurfaces = new WeakMap<readonly string[], readonly string[]>()
/** Replace the two retired town lakes with regional dry ground for painting and walking.
 * The historic source encoding remains available for existing map data. */
export function worldSurfaceRows(sector: {
  rows: readonly string[]
  charted: boolean
  townId?: string
}): readonly string[] {
  if (!sector.charted || (sector.townId !== 'frostmere' && sector.townId !== 'emberreach'))
    return sector.rows
  const cached = dryTownSurfaces.get(sector.rows)
  if (cached) return cached
  const surface = sector.rows.some((row) => row.includes('w'))
    ? sector.rows.map((row) => row.replaceAll('w', '.'))
    : sector.rows
  dryTownSurfaces.set(sector.rows, surface)
  return surface
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
