import { describe, expect, it, vi } from 'vitest'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import type { WorldPlayer, WorldSectorView, WorldView } from '@/world/types'
import { WorldPlayerMotion } from './map-player-motion'
import * as navigation from './world-motion'
import * as travel from '@/world/travel'

const cells = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, i) => ({
  x: i % GRID_WIDTH,
  y: Math.floor(i / GRID_WIDTH),
  terrain: '.',
  walkable: true,
  safe: true,
}))
const sectors = [
  { id: 'a', atlasColumn: 0, atlasRow: 0, charted: true, cells, exits: [] },
] as unknown as WorldSectorView[]
const player = (x: number, y = 1): WorldPlayer => ({
  characterId: 'remote',
  name: 'Remote',
  level: 1,
  portraitRef: '',
  imageUrl: null,
  online: true,
  attackable: false,
  position: { sectorId: 'a', x, y },
})
const view = (person: WorldPlayer, terrain = sectors): Pick<WorldView, 'players' | 'sectors'> => ({
  players: [person],
  sectors: terrain,
})

describe('confirmed remote player motion', () => {
  it('prepares navigation once per supplied graph and never pathfinds in a frame sample', () => {
    const prepare = vi.spyOn(navigation, 'prepareLocalRoute'),
      find = vi.spyOn(travel, 'findWorldRoute')
    const motion = new WorldPlayerMotion(view(player(1)), 0)
    motion.update(view(player(3)), 0)
    for (let now = 0; now < 400; now += 4) motion.sample('remote', now)
    motion.update(view(player(3)), 100)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledTimes(1)
    motion.update(view(player(3), [...sectors]), 200)
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(find).toHaveBeenCalledTimes(1)
    prepare.mockRestore()
    find.mockRestore()
  })
  it('moves only between received positions and never extrapolates after arrival', () => {
    const motion = new WorldPlayerMotion(view(player(1)), 0)
    motion.update(view(player(3)), 0)
    expect(motion.sample('remote', 0)).toEqual({ x: 1.5, y: 1.5 })
    expect(motion.sample('remote', 100)).toEqual({ x: 2, y: 1.5 })
    expect(motion.sample('remote', 400)).toEqual({ x: 3.5, y: 1.5 })
    expect(motion.sample('remote', 5000)).toEqual({ x: 3.5, y: 1.5 })
    expect(motion.moving(400)).toBe(false)
  })
  it('does not restart a segment for unchanged receipts and retains canonical attackability', () => {
    const motion = new WorldPlayerMotion(view(player(1)), 0)
    motion.update(view(player(2)), 0)
    const receipt = view({ ...player(2), attackable: true })
    motion.update(receipt, 100)
    expect(motion.sample('remote', 200)).toEqual({ x: 2.5, y: 1.5 })
    expect(motion.moving(200)).toBe(false)
    expect(receipt.players[0]!.attackable).toBe(true)
    expect(receipt.players[0]!.position).toEqual(player(2).position)
  })
  it('keeps an interrupted receipt continuous and finishes its confirmed legal edge before turning', () => {
    const motion = new WorldPlayerMotion(view(player(1)), 0)
    motion.update(view(player(2)), 0)
    const before = motion.sample('remote', 100)
    motion.update(view(player(2, 2)), 100)
    expect(motion.sample('remote', 100)).toEqual(before)
    expect(motion.sample('remote', 150)).toEqual({ x: 2.25, y: 1.5 })
    expect(motion.sample('remote', 400)).toEqual({ x: 2.5, y: 2.5 })
  })
  it('routes only through known legal dry cells instead of cutting across a water tile', () => {
    const terrain = sectors.map((sector) => ({
      ...sector,
      cells: sector.cells.map((cell) =>
        cell.x === 2 && cell.y === 1 ? { ...cell, terrain: '~', walkable: false } : cell,
      ),
    }))
    const motion = new WorldPlayerMotion(view(player(1), terrain), 0)
    motion.update(view(player(3), terrain), 0)
    for (let now = 0; now <= 800; now += 20) {
      const point = motion.sample('remote', now)!
      expect(Math.floor(point.x) === 2 && Math.floor(point.y) === 1).toBe(false)
    }
    expect(motion.sample('remote', 800)).toEqual({ x: 3.5, y: 1.5 })
  })
  it('interpolates both longitude seam directions through supplied exits', () => {
    const west = { sectorId: 'west', x: 12, y: 4 },
      east = { sectorId: 'east', x: 0, y: 4 }
    const terrain = [
      {
        ...sectors[0]!,
        id: 'west',
        atlasColumn: 127,
        exits: [{ from: west, to: east, durationMs: 400, name: 'Seam' }],
      },
      {
        ...sectors[0]!,
        id: 'east',
        atlasColumn: 0,
        exits: [{ from: east, to: west, durationMs: 400, name: 'Seam' }],
      },
    ]
    const motion = new WorldPlayerMotion(view({ ...player(0), position: west }, terrain), 0)
    motion.update(view({ ...player(0), position: east }, terrain), 0)
    expect(motion.sample('remote', 200)!.x).toBe(1664)
    expect(motion.sample('remote', 400)!.x).toBe(1664.5)
    motion.update(view({ ...player(0), position: west }, terrain), 400)
    expect(motion.sample('remote', 600)!.x).toBe(1664)
    expect(motion.sample('remote', 800)!.x).toBe(1663.5)
  })
  it('snaps large or disconnected relocations to confirmed known positions and hides unknown destinations', () => {
    const motion = new WorldPlayerMotion(view(player(1)), 0)
    motion.update(view(player(11, 7)), 100)
    expect(motion.sample('remote', 100)).toEqual({ x: 11.5, y: 7.5 })
    expect(motion.moving(100)).toBe(false)
    motion.update(view({ ...player(1), position: { sectorId: 'unloaded', x: 1, y: 1 } }), 200)
    expect(motion.sample('remote', 200)).toBeUndefined()
    expect(motion.moving(200)).toBe(false)
  })
  it('removes absent players and gives reappearing players no stale motion history', () => {
    const motion = new WorldPlayerMotion(view(player(1)), 0)
    motion.update(view(player(3)), 0)
    motion.update({ players: [], sectors }, 100)
    expect(motion.sample('remote', 100)).toBeUndefined()
    expect(motion.moving(100)).toBe(false)
    motion.update(view(player(8)), 100)
    expect(motion.sample('remote', 100)).toEqual({ x: 8.5, y: 1.5 })
    expect(motion.moving(100)).toBe(false)
  })
})
