import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { newWorldState, revealNearby, findWorldRoute } from '@/world/travel'
import type { WorldState } from '@/world/types'
import { isKnownCell, resolveSector, visibleSectors, WORLD_SECTORS } from './world-content'
import { projectWorld, projectWorldSector, resolveWorldIntent } from './world-service'
import { voidRealmLanding, voidRealmScenery } from './void-realms'

const home = 'void:ivory-veil:16:12'
const elsewhere = 'void:amber-drowned:16:12'
const allCells = Array.from({ length: 117 }, (_, i) => i)
function ashore(): WorldState {
  return revealNearby({ ...newWorldState(), position: { sectorId: home, x: 6, y: 4 } })
}

describe('lazy private Void world integration', () => {
  it('resolves remote generated ground without adding any realm to the public world catalog', () => {
    expect(resolveSector('void:ivory-veil:63:47')).toMatchObject({
      id: 'void:ivory-veil:63:47',
      charted: false,
      sceneColumn: 63,
      sceneRow: 47,
    })
    expect(WORLD_SECTORS.some((sector) => sector.id.startsWith('void:'))).toBe(false)
    expect(resolveSector('void:ivory-veil:64:47')).toBeNull()
  })

  it('keeps saved private discoveries and stale route metadata hidden away from their realm', () => {
    const state: WorldState = {
      ...newWorldState(),
      discoveries: { [home]: allCells, [elsewhere]: allCells },
      route: [{ position: { sectorId: home, x: 6, y: 4 }, durationMs: 200 }],
      routeDestination: { sectorId: elsewhere, x: 6, y: 4 },
      nextStepAt: 200,
    }
    expect(isKnownCell(state, { sectorId: home, x: 6, y: 4 })).toBe(false)
    expect(JSON.stringify(projectWorld(state, [], 0))).not.toContain('void:')
    expect(() =>
      resolveWorldIntent(state, { kind: 'walk', destination: { sectorId: home, x: 6, y: 4 } }, 0),
    ).toThrow('Survey')
  })

  it('isolates realms from old private discoveries while preserving the mainland atlas', () => {
    const state: WorldState = {
      ...ashore(),
      discoveries: {
        [home]: allCells,
        [elsewhere]: allCells,
        'uncharted-landing': allCells,
        'survey-01': allCells,
        'wild:verdant-expanse:north:1:0': allCells,
      },
    }
    const view = projectWorld(state, [], 0)
    expect(view.sectors.some((sector) => sector.id === home)).toBe(true)
    for (const sectorId of [
      elsewhere,
      'uncharted-landing',
      'survey-01',
      'wild:verdant-expanse:north:1:0',
    ]) {
      expect(isKnownCell(state, { sectorId, x: 6, y: 4 })).toBe(false)
      expect(view.sectors.some((sector) => sector.id === sectorId)).toBe(false)
      expect(() =>
        resolveWorldIntent(state, { kind: 'walk', destination: { sectorId, x: 6, y: 4 } }, 0),
      ).toThrow('Survey')
    }
    expect(view.atlas?.filter((sector) => sector.charted)).toHaveLength(1870)
    expect(view.atlas?.some((sector) => sector.id.startsWith('void:'))).toBe(false)
    expect(view.scenery).toEqual([])
  })

  it('rejects invalid cell coordinates rather than aliasing a saved discovered index', () => {
    const state = { ...ashore(), discoveries: { [home]: allCells } }
    for (const position of [
      { sectorId: home, x: 13, y: 0 },
      { sectorId: home, x: -1, y: 1 },
      { sectorId: home, x: 0, y: 9 },
      { sectorId: home, x: 0.5, y: 0 },
    ])
      expect(isKnownCell(state, position)).toBe(false)
  })

  it('discloses generated focal scenery only when its actual cell is surveyed', () => {
    const landing = voidRealmLanding('ivory-veil')
    const sector = resolveSector(landing.sectorId)!
    const art = voidRealmScenery(sector.id)!
    expect(art).toBeDefined()
    const state = { ...newWorldState(), position: landing }
    expect(projectWorldSector(state, sector).warpedScenery).toBeUndefined()
    const revealed = revealNearby({
      ...state,
      position: { sectorId: sector.id, x: art.x, y: art.y },
    })
    expect(projectWorldSector(revealed, sector).warpedScenery).toEqual(art)
    expect(
      projectWorldSector({ ...revealed, position: newWorldState().position }, sector).warpedScenery,
    ).toBeUndefined()
  })

  it('reveals only the known border entry, routes across it, and reveals around the authoritative arrival', () => {
    const sector = resolveSector(home)!
    expect(sector).not.toBeNull()
    const road = sector.roads.find((road) => road.to.sectorId !== home)!
    expect(road).toBeDefined()
    const state = revealNearby({ ...newWorldState(), position: road.from })
    const next = resolveSector(road.to.sectorId)!
    expect(isKnownCell(state, road.to)).toBe(true)
    const border = projectWorldSector(state, next).cells
    expect(border.length).toBeGreaterThan(0)
    expect(border.length).toBeLessThanOrEqual(5)
    expect(
      border.every((cell) => cell.x === 0 || cell.x === 12 || cell.y === 0 || cell.y === 8),
    ).toBe(true)
    expect(isKnownCell(state, { sectorId: next.id, x: 6, y: 4 })).toBe(false)
    expect(projectWorldSector(state, next).landmarks).toEqual([])
    const route = findWorldRoute(state.position, road.to, visibleSectors(state), (p) =>
      isKnownCell(state, p),
    )
    expect(route?.at(-1)?.position).toEqual(road.to)
    const walking = resolveWorldIntent(state, { kind: 'walk', destination: road.to }, 0)
    const arrived = resolveWorldIntent(walking, { kind: 'tick' }, road.durationMs)
    expect(arrived.position).toEqual(road.to)
    expect(arrived.discoveries[next.id]!.length).toBeGreaterThan(1)
    expect(arrived.warpedDiscoveries ?? []).toEqual([])
  })

  it('bounds repeated scene payloads even after an entire realm has been explored', () => {
    const discoveries: WorldState['discoveries'] = {}
    for (let row = 0; row < 48; row++)
      for (let column = 0; column < 64; column++)
        discoveries[`void:ivory-veil:${column}:${row}`] = allCells
    // A walking scene must use coordinate lookups, never enumerate every saved discovery.
    const state = {
      ...ashore(),
      discoveries: new Proxy(discoveries, {
        ownKeys() {
          throw new Error('Scene enumerated the full private discovery map')
        },
      }),
    }
    const view = projectWorld(state, [], 0)
    expect(view.sectors.length).toBeLessThanOrEqual(25)
    expect(view.sectors.some((sector) => sector.id === home)).toBe(true)
    expect(view.sectors.some((sector) => sector.id === 'void:ivory-veil:0:0')).toBe(false)
    expect(projectWorld(state, [], 200).sectors).toEqual(view.sectors)
  })

  it('does not load distant known sectors named by a malformed saved route', () => {
    const far = 'void:ivory-veil:0:0'
    const state: WorldState = {
      ...ashore(),
      discoveries: { [home]: allCells, [far]: allCells },
      route: [{ position: { sectorId: far, x: 6, y: 4 }, durationMs: 200 }],
      nextStepAt: 200,
    }
    expect(isKnownCell(state, state.route[0]!.position)).toBe(true)
    expect(visibleSectors(state, { sceneOnly: true }).some((sector) => sector.id === far)).toBe(
      false,
    )
    expect(projectWorld(state, [], 0).sectors.some((sector) => sector.id === far)).toBe(false)
    expect(resolveWorldIntent(state, { kind: 'tick' }, 200).position).toEqual(state.position)
  })

  it('keeps new geography stable across legacy expedition phases and bounds edge scenes', () => {
    const state = { ...ashore(), discoveries: { [home]: allCells } }
    const sector = resolveSector(home)!
    expect(projectWorldSector({ ...state, warpedPhase: 7 }, sector)).toEqual(
      projectWorldSector({ ...state, warpedPhase: 8 }, sector),
    )
    const edge = revealNearby({
      ...newWorldState(),
      position: { sectorId: 'void:ivory-veil:0:0', x: 6, y: 4 },
    })
    expect(
      projectWorld(edge, [], 0).sectors.some((sector) => sector.id === edge.position.sectorId),
    ).toBe(true)
  })
})
