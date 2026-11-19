import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { atlasSectors } from '@/world/atlas'
import { isSafe, isWalkable, newWorldState } from '@/world/travel'
import { projectWorld, projectWorldSector, resolveWorldIntent } from './world-service'
import { resolveSector } from './world-content'
import { savedWorldGeometryRecovery } from './world-geometry-recovery'
import { masterTeleportGeometry } from '@/server/master/player-teleport'
import { worldRenderTerrain } from '@/components/world/map-render-terrain'
import { buildWaterField } from '@/components/world/map-water'

it.each(['frostmere', 'emberreach'])(
  'removes the %s town lake from local, scenery and globe surfaces while retaining saved authority',
  (townId) => {
    const districts = atlasSectors().filter((sector) => sector.townId === townId)
    const formerPool = districts.find((sector) => sector.rows.some((row) => row.includes('w')))!
    const y = formerPool.rows.findIndex((row) => row.includes('w'))
    const x = formerPool.rows[y]!.indexOf('w')
    const state = {
      ...newWorldState(),
      position: { sectorId: formerPool.id, x, y },
      completedObjectives: ['saved-completion'],
      discoveries: { 'survey-01': [110] },
      objectiveProgress: { 'saved-objective': 'active' as const },
    }
    const saved = structuredClone(state)
    const view = projectWorld(state, [], 1000, undefined, undefined, { width: 1920, height: 1080 })
    const painted = worldRenderTerrain(view).filter((sector) => sector.townId === townId)
    expect(painted).toHaveLength(9)
    for (const sector of painted) {
      expect(sector.cells.some((cell) => cell.terrain === 'w' || cell.terrain === '~')).toBe(false)
      const canonical = resolveSector(sector.id)!
      expect(sector.buildings).toEqual(canonical.buildings)
      expect(sector.landmarks).toEqual(canonical.landmarks)
      for (const cell of sector.cells) {
        expect(cell.walkable).toBe(isWalkable(canonical, cell))
        expect(cell.safe).toBe(isSafe(canonical, cell))
        expect(cell.terrain).toBe(
          canonical.rows[cell.y]![cell.x] === 'w' ? '.' : canonical.rows[cell.y]![cell.x],
        )
      }
      expect(buildWaterField([sector]).get(sector.id)!.cells.size).toBe(0)
      expect(view.atlas!.find((entry) => entry.id === sector.id)?.waterTiles ?? '').not.toMatch(
        /[w~]/,
      )
    }
    expect(view.position).toEqual(state.position)
    expect(state).toEqual(saved)
    expect(savedWorldGeometryRecovery(state.position)).toBeNull()
    expect(resolveWorldIntent(state, { kind: 'tick' }, 1000).position).toEqual(state.position)
    const movementSector = projectWorldSector(state, formerPool)
    expect(movementSector.cells.find((cell) => cell.x === x && cell.y === y)?.terrain).toBe('.')
    expect(worldRenderTerrain(view)).toBe(worldRenderTerrain(view))
    const outside = atlasSectors().find(
      (sector) =>
        sector.atlasColumn === formerPool.atlasColumn! + 3 &&
        sector.atlasRow === formerPool.atlasRow,
    )!
    const distantView = projectWorld(
      { ...state, position: { sectorId: outside.id, x: 6, y: 4 } },
      [],
      1000,
      undefined,
      undefined,
      { width: 1920, height: 1080 },
    )
    expect(distantView.sectors.some((sector) => sector.id === formerPool.id)).toBe(false)
    expect(distantView.scenery!.some(([id]) => id === formerPool.id)).toBe(true)
    const distantPaint = worldRenderTerrain(distantView).find(
      (sector) => sector.id === formerPool.id,
    )!
    expect(distantPaint.cells.some((cell) => cell.terrain === 'w' || cell.terrain === '~')).toBe(
      false,
    )
    // The registered staff-teleport body is immutable even though both shallow
    // water and its replacement dry surface have identical movement and safety.
    for (const sector of districts) {
      const geometry = masterTeleportGeometry(
        {
          map: 'mainland',
          sectorNumber: sector.atlasRow! * 128 + sector.atlasColumn! + 1,
          x: 6,
          y: 4,
        },
        resolveSector,
      )[0]!
      expect(geometry.rows).toBe(sector.rows)
      expect(geometry.safeCells).toEqual(
        sector.rows.flatMap((row, y) =>
          [...row].flatMap((_, x) => (isSafe(sector, { x, y }) ? [y * 13 + x] : [])),
        ),
      )
    }
    const root = painted.find((sector) => sector.id === townId)!
    expect(root.cells.filter((cell) => cell.terrain === 'l')).toHaveLength(
      townId === 'emberreach' ? 10 : 0,
    )
  },
)

it('keeps every other town liquid, wilderness river and private surface unchanged', () => {
  const state = newWorldState()
  for (const sector of atlasSectors().filter(
    (sector) => !['frostmere', 'emberreach'].includes(sector.townId ?? ''),
  )) {
    if (!sector.rows.some((row) => /[wl~]/.test(row))) continue
    const projected = projectWorldSector(state, sector)
    for (const cell of projected.cells) expect(cell.terrain).toBe(sector.rows[cell.y]![cell.x])
  }
  const privateSector = { ...resolveSector('frostmere')!, id: 'survey-01', charted: false }
  const known = { ...state, discoveries: { 'survey-01': Array.from({ length: 117 }, (_, i) => i) } }
  for (const cell of projectWorldSector(known, privateSector).cells)
    expect(cell.terrain).toBe(privateSector.rows[cell.y]![cell.x])
})
