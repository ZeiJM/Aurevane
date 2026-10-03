import { describe, expect, it } from 'vitest'
import { createStandardBattlefieldTiles } from './standard-battlefield'
import type { CombatTile } from './board'

function connectedGround(tiles: readonly CombatTile[]): boolean {
  const ground = tiles.filter((tile) => tile.elevation === 0)
  const visited = new Set<CombatTile>()
  const queue = [ground[0]!]
  for (let index = 0; index < queue.length; index++) {
    const tile = queue[index]!
    if (visited.has(tile)) continue
    visited.add(tile)
    queue.push(
      ...ground.filter(
        (neighbor) =>
          !visited.has(neighbor) &&
          Math.abs(neighbor.position.x - tile.position.x) +
            Math.abs(neighbor.position.y - tile.position.y) ===
            1,
      ),
    )
  }
  return visited.size === ground.length
}

describe('seeded standard battlefields', () => {
  it('reproduces a seed and varies new seeds without altering input', () => {
    const input = {
      width: 9,
      height: 7,
      seed: 12345,
      spawns: [
        { x: 1, y: 3 },
        { x: 7, y: 3 },
      ],
    }
    const original = { ...input, spawns: input.spawns.map((spawn) => ({ ...spawn })) }
    const first = createStandardBattlefieldTiles(input)
    expect(createStandardBattlefieldTiles(input)).toEqual(first)
    expect(createStandardBattlefieldTiles({ ...input, seed: 12346 })).not.toEqual(first)
    expect(input).toEqual(original)
  })

  it.each([9, 12, 15])(
    'keeps %s×7 maps mostly neutral, spawns safe and flat ground connected across seeds',
    (width) => {
      for (let seed = 1; seed <= 200; seed++) {
        const spawns = [
          { x: 1, y: 3 },
          { x: width - 2, y: 3 },
          { x: 1, y: 2 },
          { x: width - 2, y: 2 },
          { x: 1, y: 4 },
          { x: width - 2, y: 4 },
        ]
        const tiles = createStandardBattlefieldTiles({ width, height: 7, seed, spawns })
        expect(tiles).toHaveLength(width * 7)
        expect(new Set(tiles.map((tile) => `${tile.position.x}:${tile.position.y}`)).size).toBe(
          width * 7,
        )
        expect(
          tiles.every(
            (tile) =>
              tile.position.x >= 0 &&
              tile.position.x < width &&
              tile.position.y >= 0 &&
              tile.position.y < 7,
          ),
        ).toBe(true)
        expect(tiles.every((tile) => tile.elevation === 0 || tile.elevation === 1)).toBe(true)
        expect(
          tiles.every(
            (tile) => tile.terrainId === 'open-ground' || tile.terrainId === 'rough-ground',
          ),
        ).toBe(true)
        expect(
          tiles.filter((tile) => tile.elevation === 0 && tile.terrainId === 'open-ground').length,
        ).toBeGreaterThan(tiles.length * 0.7)
        for (const spawn of spawns) {
          const footprint = tiles.filter(
            (tile) =>
              Math.abs(tile.position.x - spawn.x) + Math.abs(tile.position.y - spawn.y) <= 1,
          )
          expect(
            footprint.every((tile) => tile.elevation === 0 && tile.terrainId === 'open-ground'),
          ).toBe(true)
        }
        for (const tile of tiles.filter((tile) => tile.elevation > 0)) {
          expect(
            tiles.some(
              (neighbor) =>
                neighbor.elevation === tile.elevation &&
                Math.abs(tile.position.x - neighbor.position.x) +
                  Math.abs(tile.position.y - neighbor.position.y) ===
                  1,
            ),
          ).toBe(true)
        }
        expect(connectedGround(tiles)).toBe(true)
      }
    },
  )

  it('honors entered terrain and elevation biases instead of applying neutral defaults', () => {
    const counts = (bias: 'less' | 'neutral' | 'more') => {
      let rough = 0,
        raised = 0
      for (let seed = 1; seed <= 100; seed++) {
        const tiles = createStandardBattlefieldTiles({
          width: 15,
          height: 7,
          seed,
          spawns: [
            { x: 1, y: 3 },
            { x: 13, y: 3 },
          ],
          terrainBias: bias,
          elevationBias: bias,
        })
        rough += tiles.filter((tile) => tile.terrainId === 'rough-ground').length
        raised += tiles.filter((tile) => tile.elevation > 0).length
        expect(connectedGround(tiles)).toBe(true)
      }
      return { rough, raised }
    }
    const less = counts('less'),
      neutral = counts('neutral'),
      more = counts('more')
    // 95 eligible tiles remain after protecting two five-tile spawn footprints.
    expect([less.rough, neutral.rough, more.rough]).toEqual([600, 1400, 2500])
    expect(less.raised).toBeGreaterThan(0)
    expect(less.raised).toBeLessThan(neutral.raised)
    expect(neutral.raised).toBeLessThan(more.raised)
  })

  it('leaves tiny or fully protected maps flat without orphan platforms', () => {
    expect(
      createStandardBattlefieldTiles({ width: 2, height: 1, seed: 1, spawns: [{ x: 0, y: 0 }] }),
    ).toEqual([
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
    ])
  })
})
