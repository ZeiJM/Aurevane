import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { newWorldState, findWorldRoute, revealNearby } from '@/world/travel'
import { projectWorld, resolveWorldIntent } from './world-service'
import { isKnownCell, resolveSector, visibleSectors } from './world-content'
import {
  WARPED_CONTINENT_LANDING,
  applyWarpedContinentPhase,
  warpedContinentSectors,
} from './warped-continent'

describe('private uncharted continent', () => {
  it('cannot be entered by mainland travel or reconstructed from the ordinary atlas even after a visit', () => {
    const mainland = {
      ...newWorldState(),
      discoveries: { 'uncharted-landing': [58] },
      warpedPhase: 7,
    }
    const view = projectWorld(mainland, [], 0)
    // Authorized mountain frontier and Frostmere–Emberreach land corridor add
    // 55 charted public sectors without exposing private Uncharted geography.
    expect(view.atlas?.filter((sector) => sector.charted)).toHaveLength(1925)
    expect(JSON.stringify(view)).not.toContain('uncharted-landing')
    expect(JSON.stringify(view)).not.toContain('The Violet Mirror')
    expect(isKnownCell(mainland, WARPED_CONTINENT_LANDING)).toBe(false)
    expect(() =>
      resolveWorldIntent(mainland, { kind: 'walk', destination: WARPED_CONTINENT_LANDING }, 0),
    ).toThrow('Survey')
  })

  it('connects distinct private districts, without advertising them or their points of interest before arrival', () => {
    const arrival = revealNearby({
      ...newWorldState(),
      position: WARPED_CONTINENT_LANDING,
      warpedPhase: 7,
    })
    const view = projectWorld(arrival, [], 0)
    expect(view.sectors).toHaveLength(1)
    expect(view.sectors[0]?.landmarks[0]?.name).toBe('The Lost Expedition')
    expect(view.atlas?.some((sector) => sector.id.startsWith('uncharted-'))).toBe(false)
    const west = { ...arrival, position: { ...arrival.position, x: 1 } }
    const approaching = revealNearby(west)
    const destination = { sectorId: 'uncharted-orchard', x: 12, y: 4 }
    const route = findWorldRoute(
      approaching.position,
      destination,
      visibleSectors(approaching),
      (p) => isKnownCell(approaching, p),
    )
    expect(route?.at(-1)?.position).toEqual(destination)
    const neighbor = projectWorld(approaching, [], 0).sectors.find(
      (sector) => sector.id === destination.sectorId,
    )
    expect(neighbor?.cells).toHaveLength(1)
    expect(neighbor?.landmarks).toEqual([])
    expect(warpedContinentSectors).toHaveLength(13)
    for (const sector of warpedContinentSectors) {
      const endpoint = { sectorId: sector.id, x: 4, y: 3 }
      expect(
        findWorldRoute(arrival.position, endpoint, warpedContinentSectors)?.at(-1)?.position,
      ).toEqual(endpoint)
    }
  })

  it('uses one persisted phase throughout a visit and keeps every route legal when a new visit changes the rare lake', () => {
    const sector = resolveSector('uncharted-tarn')!
    const position = { sectorId: sector.id, x: 6, y: 4 }
    const state = revealNearby({ ...newWorldState(), position, warpedPhase: 7 })
    const first = projectWorld(state, [], 0).sectors[0]
    const later = projectWorld(state, [], 14 * 86_400_000).sectors[0]
    const nextVisit = projectWorld({ ...state, warpedPhase: 8 }, [], 14 * 86_400_000).sectors[0]
    expect(first?.warpedTheme).toBe('amethyst')
    expect(later).toEqual(first)
    expect(nextVisit?.warpedTheme).not.toBe(first?.warpedTheme)
    expect(nextVisit?.cells).toEqual(first?.cells)
    expect(nextVisit?.exits).toEqual(first?.exits)
    expect(applyWarpedContinentPhase(state, sector).rows).toBe(sector.rows)
  })

  it('archives a rare feature only after stopping on its cell during the matching expedition phase', () => {
    const position = { sectorId: 'uncharted-tarn', x: 8, y: 5 }
    const arriving = revealNearby({
      ...newWorldState(),
      position: { ...position, x: 7 },
      warpedPhase: 7,
    })
    const walking = resolveWorldIntent(arriving, { kind: 'walk', destination: position }, 0)
    expect(projectWorld(walking, [], 0).archive).toEqual([])
    const observed = resolveWorldIntent(walking, { kind: 'tick' }, 200)
    const after = projectWorld(observed, [], 200)
    expect(after.archive).toMatchObject([
      { id: 'warped-observation-tarn', title: 'The Violet Mirror' },
    ])
    const repeat = resolveWorldIntent(observed, { kind: 'tick' }, 400)
    expect(repeat.warpedDiscoveries).toEqual(['warped-observation-tarn'])
    expect(
      projectWorld({ ...observed, position: newWorldState().position }, [], 600).archive,
    ).toEqual(after.archive)
    const ordinaryDay = resolveWorldIntent(
      { ...observed, warpedPhase: 8, warpedDiscoveries: [] },
      { kind: 'stop' },
      0,
    )
    expect(projectWorld(ordinaryDay, [], 0).archive).toEqual([])
  })
})
