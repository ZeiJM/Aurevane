import { expect, it, vi } from 'vitest'
import { atlasSectors } from '../src/world/atlas'
import { sceneryReviewCandidates, VOID_SCENERY_VIEWS } from './world-art-scenery'
import { regionalScenery } from '../src/components/world/map-dressing'
import { warpedContinentSectors } from '../src/server/world/warped-continent'
import { projectWorld } from '../src/server/world/world-service'
import { newWorldState } from '../src/world/travel'
vi.mock('server-only', () => ({}))

it('finds all mainland scenic assets and the rare fallen star on actual supplied atlas ground', () => {
  const candidates = sceneryReviewCandidates(atlasSectors())
  for (let index = 0; index < 7; index++)
    expect(candidates.has(`regional-scenery-${index}`)).toBe(true)
  for (let index = 0; index < 3; index++)
    expect(candidates.has(`regional-scenery-extra-${index}`)).toBe(true)
  expect(candidates.has('rare-scenery-0')).toBe(true)
  for (const [key, position] of candidates) {
    const state = { ...newWorldState(), position }
    const view = projectWorld(state, [], 1000).sectors.find((s) => s.id === position.sectorId)!
    expect(
      regionalScenery(view).some((p) => `${p.sheet}-${p.index}` === key),
      key,
    ).toBe(true)
    expect(view.cells.find((c) => c.x === position.x && c.y === position.y)?.walkable).toBe(true)
  }
})

it('surveys every new Void scenic and rare time ruin on its actual revealed district terrain', () => {
  expect(new Set(VOID_SCENERY_VIEWS.map((v) => v.key)).size).toBe(5)
  for (const fixture of VOID_SCENERY_VIEWS) {
    expect(warpedContinentSectors.some((s) => s.id === fixture.sectorId)).toBe(true)
    const state = {
      ...newWorldState(),
      position: { sectorId: fixture.sectorId, x: fixture.x, y: fixture.y },
      warpedPhase: fixture.phase,
      discoveries: { [fixture.sectorId]: Array.from({ length: 117 }, (_, i) => i) },
    }
    const view = projectWorld(state, [], 1000).sectors.find((s) => s.id === fixture.sectorId)!
    expect(
      regionalScenery(view).some(
        (p) =>
          `${p.sheet}-${p.index}` === fixture.key && p.x === fixture.x && p.y + 1 === fixture.y,
      ),
    ).toBe(true)
    expect(view.cells.find((c) => c.x === fixture.x && c.y === fixture.y)?.walkable).toBe(true)
  }
})
