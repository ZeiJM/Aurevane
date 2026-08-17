import { describe, expect, it } from 'vitest'

import { P2_7_TACTICAL_HALL_ARENAS, getTacticalHallArena } from './tactical-hall-arenas'

describe('P2.7 Tactical Hall arenas', () => {
  it('keeps the deterministic micro floor and adds a materially larger duel arena', () => {
    const micro = getTacticalHallArena('basic-training-floor')
    const duel = getTacticalHallArena('duel-yard')

    expect(micro).toMatchObject({ width: 5, height: 3, scale: 'micro' })
    expect(duel).toMatchObject({ width: 9, height: 7, scale: 'duel' })
    expect(duel.tiles).toHaveLength(63)
    expect(duel.width * duel.height).toBeGreaterThan(micro.width * micro.height * 3)
  })

  it('keeps authored tiles row-major, unique and inside each arena', () => {
    for (const arena of P2_7_TACTICAL_HALL_ARENAS) {
      const keys = arena.tiles.map((tile) => `${tile.position.x}:${tile.position.y}`)
      expect(new Set(keys).size).toBe(arena.width * arena.height)
      expect(arena.tiles).toHaveLength(arena.width * arena.height)

      for (const [index, tile] of arena.tiles.entries()) {
        expect(tile.position.x).toBe(index % arena.width)
        expect(tile.position.y).toBe(Math.floor(index / arena.width))
        expect(tile.position.x).toBeGreaterThanOrEqual(0)
        expect(tile.position.x).toBeLessThan(arena.width)
        expect(tile.position.y).toBeGreaterThanOrEqual(0)
        expect(tile.position.y).toBeLessThan(arena.height)
      }

      for (const spawn of [arena.playerSpawn, arena.recruitSpawn]) {
        expect(spawn.x).toBeGreaterThanOrEqual(0)
        expect(spawn.x).toBeLessThan(arena.width)
        expect(spawn.y).toBeGreaterThanOrEqual(0)
        expect(spawn.y).toBeLessThan(arena.height)
      }
      expect(arena.playerSpawn).not.toEqual(arena.recruitSpawn)
    }
  })

  it('gives the Duel Yard multiple terrain decisions and non-immediate first contact', () => {
    const duel = getTacticalHallArena('duel-yard')
    const roughTiles = duel.tiles.filter((tile) => tile.terrainId === 'rough-ground')
    const raisedTiles = duel.tiles.filter((tile) => tile.elevation > 0)
    const manhattanDistance =
      Math.abs(duel.playerSpawn.x - duel.recruitSpawn.x) +
      Math.abs(duel.playerSpawn.y - duel.recruitSpawn.y)

    expect(roughTiles.length).toBeGreaterThanOrEqual(5)
    expect(raisedTiles.length).toBeGreaterThanOrEqual(2)
    expect(manhattanDistance).toBeGreaterThan(4)
  })
})
