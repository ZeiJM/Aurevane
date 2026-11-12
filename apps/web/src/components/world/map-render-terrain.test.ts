import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { advanceWorldRoute, newWorldState } from '@/world/travel'
import { projectWorld, projectWorldSector, resolveWorldIntent } from '@/server/world/world-service'
import { resolveSector } from '@/server/world/world-content'
import { retainWorldSceneReferences } from '@/world/presence'
import { mergeWorldMovement } from '@/world/movement-receipt'
import { worldRenderTerrain } from './map-render-terrain'

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
