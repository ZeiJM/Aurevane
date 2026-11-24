import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { advanceWorldRoute, newWorldState, revealNearby } from '@/world/travel'
import { projectWorld, projectWorldSector, resolveWorldIntent } from '@/server/world/world-service'
import { isKnownCell, resolveSector } from '@/server/world/world-content'
import { localRoute, mapPoint } from './world-motion'
import { unprojectMapPoint } from './map-projection'
import { decodeTerrainRows } from '@/world/terrain'
import { retainWorldSceneReferences } from '@/world/presence'
import { mergeWorldMovement } from '@/world/movement-receipt'
import { worldRenderTerrain } from './map-render-terrain'

it.each(['void:ivory-veil:16:12', 'uncharted-expanse:32:24'])(
  'paints unsurveyed Uncharted landscape in %s without expanding navigation or changing progress',
  (sectorId) => {
    const state = revealNearby({ ...newWorldState(), position: { sectorId, x: 6, y: 4 } })
    const saved = structuredClone(state)
    const view = projectWorld(state, [], 1000)
    const known = view.sectors.find((sector) => sector.id === sectorId)!
    expect(known.cells).toHaveLength(25)
    expect((view.unchartedTerrain ?? []).length).toBeGreaterThan(25)
    expect(view.unchartedTerrain!.length).toBeLessThanOrEqual(512)
    const terrain = worldRenderTerrain(view)
    const painted = terrain.find((sector) => sector.id === sectorId)!
    expect(painted.cells).toHaveLength(117)
    expect(painted.landmarks).toEqual(known.landmarks)
    expect(painted.exits).toEqual(known.exits)
    const unseen = painted.cells.find(
      (cell) => cell.walkable && !isKnownCell(state, { sectorId, ...cell }),
    )!
    expect(unseen).toBeDefined()
    expect(localRoute(view, state.position, { sectorId, x: unseen.x, y: unseen.y })).toBeNull()
    expect(view.sectors.find((sector) => sector.id === sectorId)).toBe(known)
    expect(state).toEqual(saved)
    expect(worldRenderTerrain(view)).toBe(terrain)
    const cloned = retainWorldSceneReferences(view, JSON.parse(JSON.stringify(view)))
    expect(cloned.unchartedTerrain).toBe(view.unchartedTerrain)
    expect(worldRenderTerrain(cloned)).toBe(terrain)
  },
)

it('covers the minimum-zoom private viewport with canonical terrain and no private location names', () => {
  const state = revealNearby({
    ...newWorldState(),
    position: { sectorId: 'void:ivory-veil:32:24', x: 6, y: 4 },
  })
  for (const [width, height] of [
    [390, 844],
    [1296, 944],
    [1920, 1080],
  ]) {
    const view = projectWorld(state, [], 1000, undefined, undefined, {
      width: width!,
      height: height!,
    })
    const terrain = worldRenderTerrain(view)
    const camera = mapPoint(state.position, view.sectors)
    const tile = (width! < 600 ? 48 : 64) * 0.35
    for (const [x, y] of [
      [0, 0],
      [width!, 0],
      [0, height!],
      [width!, height!],
    ]) {
      const ground = unprojectMapPoint(
        { x: x!, y: y! },
        camera,
        { x: 0, y: 0 },
        tile,
        width!,
        height!,
      )
      const id = `void:ivory-veil:${Math.floor(ground.x / 13)}:${Math.floor(ground.y / 9)}`
      expect(
        terrain.some((sector) => sector.id === id),
        `${width}x${height} corner ${x},${y}`,
      ).toBe(true)
    }
    for (const chunk of view.unchartedTerrain!) {
      expect(chunk).toHaveLength(7)
      expect(decodeTerrainRows(chunk[1], 117)).toBe(resolveSector(chunk[0])!.rows.join(''))
      expect(chunk[0]).toMatch(/^void:ivory-veil:/)
    }
    expect(view.atlas?.some((sector) => sector.id.startsWith('void:'))).toBe(false)
  }
})

it('withdraws private terrain on leaving Uncharted and rejects retained geometry from another realm', () => {
  const state = revealNearby({
    ...newWorldState(),
    position: { sectorId: 'void:ivory-veil:32:24', x: 6, y: 4 },
  })
  const privateView = projectWorld(state, [], 1000)
  const otherRealm = projectWorld(
    revealNearby({
      ...newWorldState(),
      position: { ...state.position, sectorId: 'void:hollow-orchard:16:10' },
    }),
    [],
    1000,
  )
  for (const unchartedTerrain of [[], undefined]) {
    const transitioning = {
      ...privateView,
      sectors: [...privateView.sectors, ...otherRealm.sectors],
      unchartedTerrain,
    }
    expect(
      worldRenderTerrain(transitioning).some((s) => s.id.startsWith('void:hollow-orchard:')),
    ).toBe(false)
  }
  expect((privateView.unchartedTerrain ?? []).length).toBeGreaterThan(0)
  const returned = { ...state, position: newWorldState().position }
  const retainedScene = {
    ...privateView,
    position: returned.position,
    sectors: [
      ...privateView.sectors,
      projectWorldSector(returned, resolveSector(returned.position.sectorId)!),
    ],
  }
  expect(worldRenderTerrain(retainedScene).some((sector) => sector.id.startsWith('void:'))).toBe(
    false,
  )
  for (const sectorId of ['verdant-expanse', 'survey-01', 'void:amber-drowned:32:24']) {
    const next = projectWorld({ ...state, position: { sectorId, x: 6, y: 4 } }, [], 1000)
    if (!sectorId.startsWith('void:')) expect(next.unchartedTerrain).toBeUndefined()
    const stale = { ...next, unchartedTerrain: privateView.unchartedTerrain }
    expect(
      worldRenderTerrain(stale).some((sector) => sector.id.startsWith('void:ivory-veil:')),
    ).toBe(false)
  }
})

it('preserves canonical Frostmere ground while a real approved route leaves the initial authority scene', () => {
  const state = { ...newWorldState(), position: { sectorId: 'frostmere', x: 6, y: 4 } }
  const initial = projectWorld(state, [], 1000)
  const before = worldRenderTerrain(initial)
  const authorityIds = new Set(initial.sectors.map((sector) => sector.id))
  const displaced = initial.sectors[24]!
  const destination = before
    .filter(
      (sector) =>
        !authorityIds.has(sector.id) &&
        sector.cells.some((cell) => cell.x === 6 && cell.y === 4 && cell.walkable),
    )
    .sort(
      (a, b) =>
        (a.atlasColumn! - displaced.atlasColumn!) ** 2 +
        (a.atlasRow! - displaced.atlasRow!) ** 2 -
        ((b.atlasColumn! - displaced.atlasColumn!) ** 2 + (b.atlasRow! - displaced.atlasRow!) ** 2),
    )[0]!
  expect(destination).toBeDefined()
  const walking = resolveWorldIntent(
    state,
    {
      kind: 'walk',
      destination: { sectorId: destination.id, x: 6, y: 4 },
    },
    1000,
  )
  let deadline = 1000
  let arrived = walking
  for (const step of walking.route) {
    deadline += step.durationMs
    arrived = advanceWorldRoute(walking, deadline)
    if (!authorityIds.has(arrived.position.sectorId)) break
  }
  expect(authorityIds.has(arrived.position.sectorId)).toBe(false)
  const currentSector = projectWorldSector(arrived, resolveSector(arrived.position.sectorId)!)
  const next = mergeWorldMovement(initial, {
    kind: 'movement',
    characterId: initial.characterId,
    version: initial.version + 1,
    serverNow: deadline,
    position: arrived.position,
    route: arrived.route,
    nextStepAt: arrived.nextStepAt,
    movementBlocked: null,
    battleSessionId: null,
    currentSector,
  })
  expect(next.sectors).toHaveLength(25)
  expect(next.sectors.some((sector) => sector.id === displaced.id)).toBe(false)
  const after = worldRenderTerrain(next, before)
  expect(after.map((sector) => sector.id).sort()).toEqual(before.map((sector) => sector.id).sort())
  expect(after.find((sector) => sector.id === displaced.id)?.cells).toEqual(displaced.cells)
})

it('renders exact canonical public ground without expanding the authority or presence scene', () => {
  const state = { ...newWorldState(), position: { sectorId: 'atlas:62:28', x: 6, y: 4 } }
  const view = projectWorld(state, [], 1000)
  const original = view.sectors
  const terrain = worldRenderTerrain(view)
  expect(terrain.length).toBeGreaterThan(view.sectors.length)
  expect(view.sectors).toBe(original)
  expect(view.sectors.length).toBeLessThanOrEqual(25)
  for (const scenery of view.scenery!) {
    expect(scenery).toHaveLength(5)
    const expanded = terrain.find((sector) => sector.id === scenery[0])!
    const canonical = projectWorldSector(state, resolveSector(scenery[0])!)
    expect(expanded.cells).toEqual(canonical.cells)
    expect(expanded.landmarks).toEqual(canonical.landmarks)
    expect(expanded.buildings).toEqual(canonical.buildings)
    expect(expanded.exits).toEqual([])
  }
  expect(worldRenderTerrain(view)).toBe(terrain)
  const next = retainWorldSceneReferences(view, JSON.parse(JSON.stringify(view)))
  expect(next.scenery).toBe(view.scenery)
  expect(worldRenderTerrain(next)).toBe(terrain)
})
it('withholds all extra scenery inside private terrain and removes withdrawn public presentation', () => {
  const publicView = projectWorld(newWorldState(), [], 1000)
  expect(worldRenderTerrain(publicView).length).toBeGreaterThan(publicView.sectors.length)
  const privateView = projectWorld(
    { ...newWorldState(), position: { sectorId: 'survey-01', x: 6, y: 8 } },
    [],
    1000,
  )
  expect(privateView.scenery).toEqual([])
  expect(worldRenderTerrain(privateView)).toBe(privateView.sectors)
  const withheld = retainWorldSceneReferences(publicView, { ...publicView, scenery: [] })
  expect(worldRenderTerrain(withheld)).toBe(withheld.sectors)
})

it('retains indexed public terrain when authority order or presentation partition changes', () => {
  const state = { ...newWorldState(), position: { sectorId: 'atlas:62:28', x: 6, y: 4 } }
  const view = projectWorld(state, [], 1000)
  const before = worldRenderTerrain(view)
  const reordered = { ...view, sectors: [...view.sectors].reverse() }
  expect(worldRenderTerrain(reordered, before)).toBe(before)
  expect(worldRenderTerrain(JSON.parse(JSON.stringify(reordered)), before)).toBe(before)
  const promoted = view.scenery![0]!
  const projected = projectWorldSector(state, resolveSector(promoted[0])!)
  const shifted = {
    ...view,
    sectors: [...view.sectors, projected],
    scenery: view.scenery!.filter((sector) => sector[0] !== promoted[0]),
  }
  expect(worldRenderTerrain(shifted, before)).toBe(before)
  const changed = {
    ...view,
    sectors: view.sectors.map((sector, index) =>
      index
        ? sector
        : {
            ...sector,
            cells: sector.cells.map((cell, i) =>
              i ? cell : { ...cell, terrain: '~', walkable: false },
            ),
          },
    ),
  }
  expect(worldRenderTerrain(changed, before)).not.toBe(before)
  expect(worldRenderTerrain({ ...view, scenery: [] }, before)).not.toBe(before)
})
