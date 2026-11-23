import { GRID_HEIGHT, GRID_WIDTH } from './catalog'
import { terrainWalkable } from './terrain'
import { wrapAtlasColumn } from './topology'
import type { WorldSector } from './types'

/** Remove pavement frontages, never collision terrain or saved walking positions. */
export function trimRoadShorelines(sectors: readonly WorldSector[]) {
  const byAddress = new Map(
    sectors.map((sector) => [`${sector.atlasColumn}:${sector.atlasRow}`, sector]),
  )
  const at = (sector: WorldSector, x: number, y: number) => {
    const worldX = sector.atlasColumn! * GRID_WIDTH + x
    const worldY = sector.atlasRow! * GRID_HEIGHT + y
    const column = wrapAtlasColumn(Math.floor(worldX / GRID_WIDTH))
    const row = Math.floor(worldY / GRID_HEIGHT)
    const target = byAddress.get(`${column}:${row}`)
    if (!target) return null
    const localX = ((worldX % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH
    const localY = ((worldY % GRID_HEIGHT) + GRID_HEIGHT) % GRID_HEIGHT
    return { sector: target, x: localX, y: localY, terrain: target.rows[localY]![localX]! }
  }
  const paved = (terrain: string | undefined) => terrain === '=' || terrain === 's'
  const liquid = (terrain: string | undefined) => terrain === '~' || terrain === 'l'
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const
  // Match the existing bridge geometry: a known deck between matching liquid
  // flanks, ending on two dry walkable banks. A road beside water is not a bridge.
  const crossing = (sector: WorldSector, x: number, y: number, dx: number, dy: number) => {
    if (!paved(at(sector, x, y)?.terrain)) return false
    const flank = (sign: number) => {
      for (let i = 1; i <= 4; i++) {
        const next = at(sector, x + dy * sign * i, y + dx * sign * i)
        if (liquid(next?.terrain)) return next!.terrain
        if (!paved(next?.terrain)) break
      }
      return null
    }
    const before = flank(-1),
      after = flank(1)
    return before !== null && before === after
  }
  const bridge = (sector: WorldSector, x: number, y: number) => {
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      if (!crossing(sector, x, y, dx, dy)) continue
      const bank = (sign: number) => {
        for (let i = 1; i <= 5; i++) {
          const nextX = x + dx * sign * i,
            nextY = y + dy * sign * i
          if (crossing(sector, nextX, nextY, dx, dy)) continue
          const next = at(sector, nextX, nextY)
          return next !== null && terrainWalkable(next.terrain)
        }
        return false
      }
      if (bank(-1) && bank(1)) return true
    }
    return false
  }
  const keep = new Set<string>()
  const key = (sector: WorldSector, x: number, y: number) => `${sector.id}:${x}:${y}`
  for (const sector of sectors) {
    for (const landmark of sector.landmarks)
      if (landmark.kind !== 'bridge') keep.add(key(sector, landmark.x, landmark.y))
    for (let y = 0; y < GRID_HEIGHT; y++)
      for (let x = 0; x < GRID_WIDTH; x++) {
        // Standalone settlement cells are protected by 's' itself. Only towns
        // whose enclosing district remains safe can replace that pavement.
        if (
          sector.rows[y]![x] === 's' &&
          !(sector.townId && (sector.id !== sector.townId || x < 10))
        )
          keep.add(key(sector, x, y))
        if (paved(sector.rows[y]![x]) && bridge(sector, x, y)) keep.add(key(sector, x, y))
      }
  }
  const remove = new Set<string>()
  for (const sector of sectors)
    for (let y = 0; y < GRID_HEIGHT; y++)
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (!paved(sector.rows[y]![x]) || keep.has(key(sector, x, y))) continue
        for (const [dx, dy] of directions) {
          const next = at(sector, x + dx, y + dy)
          if (next && !liquid(next.terrain)) continue
          // Keep two tiles of natural ground before the shoreline. Read the
          // original rows so neighboring sectors and traversal order agree.
          for (let i = 0; i < 2; i++) {
            const end = at(sector, x - dx * i, y - dy * i)
            if (!end || !paved(end.terrain) || keep.has(key(end.sector, end.x, end.y))) break
            remove.add(key(end.sector, end.x, end.y))
          }
        }
      }
  for (const sector of sectors)
    sector.rows = sector.rows.map((row, y) =>
      [...row].map((terrain, x) => (remove.has(key(sector, x, y)) ? '.' : terrain)).join(''),
    )
}
