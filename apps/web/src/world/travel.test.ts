import { describe, expect, it } from 'vitest'
import { WORLD_REGIONS, CHARTED_SECTORS, START_POSITION } from './catalog'
import { advanceWorldRoute, canAutoPath, cellCenter, findWorldRoute, newWorldState } from './travel'

describe('world travel', () => {
  it('keeps all eight canonical regions distinct', () => {
    expect(WORLD_REGIONS.map((r) => r.name)).toEqual([
      'Aureth Crown',
      'Verdant Expanse',
      'Emberreach',
      'Frostmere',
      'Glasswind Desert',
      'Hollow Coast',
      'Starfall Highlands',
      'Umbral March',
    ])
    expect(new Set(WORLD_REGIONS.map((r) => r.art)).size).toBe(8)
  })
  it('routes over the bridge instead of through water', () => {
    const route = findWorldRoute(
      { sectorId: 'verdant-expanse', x: 9, y: 3 },
      { sectorId: 'verdant-expanse', x: 11, y: 3 },
      CHARTED_SECTORS,
    )
    expect(route?.map((s) => s.position)).toContainEqual({
      sectorId: 'verdant-expanse',
      x: 10,
      y: 4,
    })
    expect(route?.some((s) => s.position.x === 10 && s.position.y !== 4)).toBe(false)
  })
  it('rejects blocked, out of range and unknown destinations', () => {
    for (const to of [
      { ...START_POSITION, x: 10, y: 2 },
      { ...START_POSITION, x: 13 },
      { ...START_POSITION, sectorId: 'unknown' },
    ])
      expect(findWorldRoute(START_POSITION, to, CHARTED_SECTORS)).toBeNull()
  })
  it('crosses a regional road with elapsed travel time', () => {
    const route = findWorldRoute(
      START_POSITION,
      { sectorId: 'aureth-crown', x: 6, y: 4 },
      CHARTED_SECTORS,
    )!
    expect(route.length).toBeGreaterThan(1)
    expect(route.some((s) => s.durationMs >= 15000)).toBe(true)
    expect(route.at(-1)?.position).toEqual({ sectorId: 'aureth-crown', x: 6, y: 4 })
  })
  it('advances only one due step even after a long disconnect', () => {
    const state = {
      ...newWorldState(),
      route: findWorldRoute(START_POSITION, { ...START_POSITION, x: 9 }, CHARTED_SECTORS)!,
      nextStepAt: 1000,
    }
    expect(advanceWorldRoute(state, 999).position).toEqual(START_POSITION)
    const next = advanceWorldRoute(state, 999999)
    expect(next.position.x).toBe(START_POSITION.x + 1)
    expect(next.route.length).toBe(state.route.length - 1)
    expect(next.nextStepAt).toBeGreaterThan(999999)
  })
  it('keeps event restrictions scoped to that objective', () => {
    expect(canAutoPath({ kind: 'event', autoPath: false, guidance: 'exact' })).toBe(false)
    expect(canAutoPath({ kind: 'quest', autoPath: true, guidance: 'exact' })).toBe(true)
    expect(canAutoPath({ kind: 'quest', autoPath: true, guidance: 'clue' })).toBe(false)
  })
  it('centres tokens in square cells independently of rendering scale', () => {
    expect(cellCenter({ x: 0, y: 0 })).toEqual({ x: 0.5 / 13, y: 0.5 / 9 })
    expect(cellCenter({ x: 12, y: 8 })).toEqual({ x: 12.5 / 13, y: 8.5 / 9 })
  })
})
