import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import {
  applyWarpedContinentPhase,
  warpedContinentSectors,
} from '../src/server/world/warped-continent'
import { newWorldState } from '../src/world/travel'
import { VOID_SCENERY_VIEWS } from './world-art-scenery'
import { worldArtCadenceSql, worldArtPhasePeriod } from './world-art-phase'

it('preserves every legacy district theme, rare landmark and refuge at real equivalent phases', () => {
  for (const sector of warpedContinentSectors) {
    for (let phase = 0; phase <= 19; phase++) {
      const period = worldArtPhasePeriod(sector.id)
      const state = { ...newWorldState(), warpedPhase: phase }
      for (const cycles of [1, 100, 1000])
        expect(
          applyWarpedContinentPhase({ ...state, warpedPhase: phase + cycles * period }, sector),
          `${sector.id}, representative phase ${phase}`,
        ).toEqual(applyWarpedContinentPhase(state, sector))
    }
  }
  for (const fixture of VOID_SCENERY_VIEWS)
    expect(warpedContinentSectors.some(({ id }) => id === fixture.sectorId)).toBe(true)
})

it('finds a legal real cadence with capture time for every requested visual phase', () => {
  for (const now of [1_800_000_000_000, Date.UTC(2026, 10, 14, 23, 59), Date.UTC(2027, 0, 1)]) {
    for (const sector of warpedContinentSectors) {
      const period = worldArtPhasePeriod(sector.id)
      for (let representativePhase = 0; representativePhase <= 19; representativePhase++) {
        const minutes = Array.from({ length: 10080 }, (_, i) => 10080 - i).find((minutes) => {
          const phase = Math.floor(now / (minutes * 60000))
          return (
            phase % period === representativePhase % period &&
            (phase + 1) * minutes * 60000 - 60000 - now > 240000
          )
        })
        expect(minutes, `${sector.id}, representative phase ${representativePhase}`).toBeDefined()
        expect(worldArtCadenceSql(sector.id, representativePhase)).toContain(
          `phase % ${period} = ${representativePhase % period}`,
        )
      }
    }
  }
})

it('rejects invalid representative phase values before generating fixture SQL', () => {
  for (const phase of [-1, 0.5, Infinity, NaN])
    expect(() => worldArtCadenceSql('uncharted-belfry', phase)).toThrow('Invalid art phase')
})
