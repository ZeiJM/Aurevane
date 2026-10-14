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
const approved = (
  x: number,
  route: { position: WorldPlayer['position']; durationMs: number }[],
  serverNow = 1000,
  nextStepAt: number | null = 1200,
  version = 1,
): WorldPlayer => Object.assign(player(x), { movement: { version, serverNow, nextStepAt, route } })
const step = (x: number, y = 1, durationMs = 200) => ({
  position: { sectorId: 'a', x, y },
  durationMs,
})

describe('approved remote movement clocks', () => {
  it('starts a newly approved route from its already presented standing pose without skipping late steps', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [], 1000, null, 1)), 0)
    const before = motion.sample('remote', 70)
    motion.update(view(approved(1, [step(2), step(3), step(4)], 1300, 1200, 2)), 70)
    expect(motion.sample('remote', 70)).toEqual(before)
    expect(motion.sample('remote', 170)).toEqual({ x: 2, y: 1.5 })
    expect(motion.sample('remote', 670)).toEqual({ x: 4.5, y: 1.5 })
  })
  it('finishes the supplied visual prefix before a newer canonical origin and final arrival', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [step(2), step(3), step(4)])), 0)
    const before = motion.sample('remote', 100)
    const next = view(approved(3, [step(4)], 1450, 1600, 2))
    motion.update(next, 100)
    expect(motion.sample('remote', 100)).toEqual(before)
    expect(motion.sample('remote', 200)).toEqual({ x: 2.5, y: 1.5 })
    expect(motion.sample('remote', 400)).toEqual({ x: 3.5, y: 1.5 })
    const finalBefore = motion.sample('remote', 500)
    motion.update(view(approved(4, [], 1800, null, 3)), 500)
    expect(motion.sample('remote', 500)).toEqual(finalBefore)
    expect(motion.sample('remote', 600)).toEqual({ x: 4.5, y: 1.5 })
    expect(motion.sample('remote', 5000)).toEqual({ x: 4.5, y: 1.5 })
    expect(next.players[0]!.position).toEqual(player(3).position)
    expect(next.players[0]!.movement?.nextStepAt).toBe(1600)
  })
  it('hides an absent peer immediately but safely joins its fresh seam approval from its last presented pose', () => {
    const west = { sectorId: 'a', x: 12, y: 1 },
      east = { sectorId: 'b', x: 0, y: 1 }
    const terrain = [
      { ...sectors[0]!, exits: [{ from: west, to: east, durationMs: 200, name: 'Seam' }] },
      { ...sectors[0]!, id: 'b', atlasColumn: 1, exits: [] },
    ]
    const route = [0, 1, 2, 3].map((x) => ({
      position: { ...east, x },
      durationMs: 200,
    }))
    const receipt = (
      position: WorldPlayer['position'],
      steps: typeof route,
      serverNow: number,
      nextStepAt: number | null,
      version: number,
    ) => view({ ...approved(12, steps, serverNow, nextStepAt, version), position }, terrain)
    const motion = new WorldPlayerMotion(receipt(west, [], 1000, null, 1), 0)
    const before = motion.sample('remote', 0)
    motion.update({ players: [], sectors: terrain }, 50)
    expect(motion.sample('remote', 50)).toBeUndefined()
    expect(motion.moving(50)).toBe(false)
    motion.update(receipt(west, route, 1264, 1200, 2), 100)
    expect(motion.sample('remote', 100)).toEqual(before)
    expect(motion.sample('remote', 183.3)!.x - before!.x).toBeLessThan(0.75)
    const advanced = motion.sample('remote', 350)
    motion.update(receipt({ ...east, x: 2 }, [route[3]!], 1762, 1800, 3), 350)
    expect(motion.sample('remote', 350)).toEqual(advanced)
    const final = motion.sample('remote', 600)
    motion.update(receipt({ ...east, x: 3 }, [], 2000, null, 4), 600)
    expect(motion.sample('remote', 600)).toEqual(final)
    expect(motion.sample('remote', 900)).toEqual({ x: 16.5, y: 1.5 })
    expect(motion.moving(900)).toBe(false)
  })
  it('closes a retained prefix when its old private ground is withdrawn', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [step(2), step(3), step(4)])), 0)
    motion.sample('remote', 100)
    motion.update(view(approved(3, [step(4)], 1450, 1600, 2)), 100)
    const terrain = sectors.map((sector) => ({
      ...sector,
      cells: sector.cells.filter((cell) => cell.x !== 2 || cell.y !== 1),
    }))
    motion.update(view(approved(3, [step(4)], 1450, 1600, 2), terrain), 150)
    expect(motion.sample('remote', 200)).toEqual({ x: 3.5, y: 1.5 })
    expect(motion.moving(200)).toBe(false)
  })
  it('preserves its presented fraction when a newer agreeing clock is further ahead', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [step(2), step(3)])), 0)
    const before = motion.sample('remote', 50)
    motion.update(view(approved(1, [step(2), step(3)], 1190, 1200, 2)), 50)
    expect(motion.sample('remote', 50)).toEqual(before)
    expect(motion.sample('remote', 100)).toEqual({ x: 2, y: 1.5 })
  })
  it('does not render a stale reappearance and resumes only after a fresh approved version', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [], 1000, null, 5)), 0)
    motion.sample('remote', 0)
    motion.update({ players: [], sectors }, 50)
    motion.update(view(approved(1, [step(2)], 1100, 1200, 4)), 100)
    expect(motion.sample('remote', 100)).toBeUndefined()
    expect(motion.moving(100)).toBe(false)
    motion.update(view(approved(1, [step(2)], 1100, 1200, 6)), 110)
    expect(motion.sample('remote', 110)).toEqual({ x: 1.5, y: 1.5 })
    expect(motion.sample('remote', 210)).toEqual({ x: 2, y: 1.5 })
  })
  it('expires an unseen pose instead of reviving it after a long absence', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [], 1000, null, 1)), 0)
    motion.sample('remote', 0)
    motion.update({ players: [], sectors }, 50)
    motion.update(view(approved(1, [step(2)], 1100, 1200, 2)), 9000)
    expect(motion.sample('remote', 9000)).toEqual({ x: 2, y: 1.5 })
  })
  it('freezes a briefly absent approved phase without rendering or restarting its route', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [step(2), step(3)])), 0)
    const before = motion.sample('remote', 100)
    motion.update({ players: [], sectors }, 120)
    expect(motion.sample('remote', 120)).toBeUndefined()
    expect(motion.moving(120)).toBe(false)
    motion.update(view(approved(1, [step(2), step(3)], 1200, 1200)), 200)
    expect(motion.sample('remote', 200)).toEqual(before)
    expect(motion.sample('remote', 300)).toEqual({ x: 2.5, y: 1.5 })
    expect(motion.sample('remote', 500)).toEqual({ x: 3.5, y: 1.5 })
  })
  it('bounds unseen pose retention even when many approved players leave together', () => {
    const players = Array.from({ length: 101 }, (_, i) => ({
      ...approved(1, [], 1000, null, 1),
      characterId: `remote-${i}`,
    }))
    const motion = new WorldPlayerMotion({ players, sectors }, 0)
    for (const person of players) motion.sample(person.characterId, 0)
    motion.update({ players: [], sectors }, 50)
    const returning = [0, 100].map((i) => ({
      ...approved(1, [step(2)], 1100, 1200, 2),
      characterId: `remote-${i}`,
    }))
    motion.update({ players: returning, sectors }, 100)
    expect(motion.sample('remote-0', 100)).toEqual({ x: 2, y: 1.5 })
    expect(motion.sample('remote-100', 100)).toEqual({ x: 1.5, y: 1.5 })
  })
  it('starts a delayed first receipt at the approved fraction without changing confirmed position', () => {
    const receipt = view(approved(1, [step(2), step(3)], 1100))
    const motion = new WorldPlayerMotion(receipt, 5000)
    expect(motion.sample('remote', 5000)).toEqual({ x: 2, y: 1.5 })
    expect(motion.sample('remote', 5100)).toEqual({ x: 2.5, y: 1.5 })
    expect(motion.sample('remote', 5200)).toEqual({ x: 3, y: 1.5 })
    expect(motion.sample('remote', 5300)).toEqual({ x: 3.5, y: 1.5 })
    expect(receipt.players[0]!.position).toEqual(player(1).position)
    expect(receipt.players[0]!.attackable).toBe(false)
  })
  it('joins agreeing approved versions without stepping backward when delivery latency changes', () => {
    const motion = new WorldPlayerMotion(
      view(approved(1, [step(2), step(3), step(4)], 1100, 1200, 1)),
      0,
    )
    const before = motion.sample('remote', 200)
    expect(before).toEqual({ x: 3, y: 1.5 })
    const next = view(approved(2, [step(3), step(4)], 1250, 1400, 2))
    motion.update(next, 200)
    expect(motion.sample('remote', 200)).toEqual(before)
    expect(motion.sample('remote', 300)).toEqual({ x: 3.5, y: 1.5 })
    expect(motion.sample('remote', 400)).toEqual({ x: 4, y: 1.5 })
    expect(next.players[0]!.movement).toEqual({
      version: 2,
      serverNow: 1250,
      nextStepAt: 1400,
      route: [step(3), step(4)],
    })
  })
  it('does not join a previous forward phase onto an explicitly reversed approved step', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [step(2)], 1000, 1200, 1)), 0)
    expect(motion.sample('remote', 100)).toEqual({ x: 2, y: 1.5 })
    motion.update(view(approved(2, [step(1)], 1250, 1400, 2)), 100)
    expect(motion.sample('remote', 100)).toEqual({ x: 2.25, y: 1.5 })
    expect(motion.sample('remote', 150)).toEqual({ x: 2, y: 1.5 })
  })
  it('ignores stale versions and repeated clocks instead of restarting or stepping backward', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [step(2), step(3)], 1100, 1200, 3)), 5000)
    const before = motion.sample('remote', 5100)
    motion.update(view(approved(8, [step(9)], 1000, 1200, 2)), 5100)
    expect(motion.sample('remote', 5100)).toEqual(before)
    motion.update(view(approved(1, [step(2), step(3)], 1050, 1200, 3)), 5100)
    expect(motion.sample('remote', 5200)).toEqual({ x: 3, y: 1.5 })
  })
  it('closes an old route on an authoritative stop or replacement', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [step(2), step(3)])), 0)
    expect(motion.sample('remote', 100)).toEqual({ x: 2, y: 1.5 })
    motion.update(view(approved(1, [step(1, 2)], 1100, 1200, 2)), 100)
    expect(motion.sample('remote', 100)).toEqual({ x: 1.5, y: 2 })
    motion.update(view(approved(1, [], 1150, null, 3)), 150)
    expect(motion.sample('remote', 1000)).toEqual({ x: 1.5, y: 1.5 })
    expect(motion.moving(1000)).toBe(false)
  })
  it('freezes the last presented point across suspension instead of catching up offline', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [step(2), step(3)])), 0)
    const before = motion.sample('remote', 100)
    expect(motion.sample('remote', 9000)).toEqual(before)
    expect(motion.moving(9000)).toBe(false)
    motion.update(view(approved(1, [step(2), step(3)], 10000, 1200)), 9000)
    expect(motion.sample('remote', 9000)).toEqual(before)
    expect(motion.moving(9000)).toBe(false)
    const stale = new WorldPlayerMotion(view(approved(1, [step(2)], 10000, 1200)), 9000)
    expect(stale.sample('remote', 9000)).toEqual({ x: 1.5, y: 1.5 })
    expect(stale.moving(9000)).toBe(false)
  })
  it('cannot start or restart an aged offline route with an unchanged version', () => {
    const offline = { ...approved(1, [step(2), step(3)]), online: false }
    const motion = new WorldPlayerMotion(view(offline), 0)
    expect(motion.sample('remote', 100)).toEqual({ x: 1.5, y: 1.5 })
    expect(motion.moving(100)).toBe(false)
    motion.update(view(approved(1, [step(2), step(3)], 1100)), 100)
    expect(motion.sample('remote', 200)).toEqual({ x: 1.5, y: 1.5 })
    motion.update(view(approved(1, [step(2), step(3)], 1200, 1400, 2)), 200)
    expect(motion.sample('remote', 300)).toEqual({ x: 2, y: 1.5 })
    motion.update(view({ ...approved(1, [step(2), step(3)], 1300, 1400, 2), online: false }), 300)
    expect(motion.sample('remote', 400)).toEqual({ x: 1.5, y: 1.5 })
    expect(motion.moving(400)).toBe(false)
  })
  it('retains its version guard across malformed envelopes and capability fallback', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [step(2)], 1000, 1200, 5)), 0)
    motion.update(view(Object.assign(player(1), { movement: null })), 100)
    motion.update(view(approved(1, [step(2)], 1050, 1200, 5)), 100)
    expect(motion.sample('remote', 150)).toEqual({ x: 1.5, y: 1.5 })
    motion.update(view(approved(8, [step(9)], 1000, 1200, 4)), 150)
    expect(motion.sample('remote', 150)).toEqual({ x: 1.5, y: 1.5 })
    motion.update(view(player(1)), 200)
    motion.update(view(approved(8, [step(9)], 1000, 1200, 4)), 250)
    expect(motion.sample('remote', 250)).toEqual({ x: 1.5, y: 1.5 })
  })
  it('revalidates the authored duration on changed terrain even for an unchanged version', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [step(2)])), 0)
    motion.sample('remote', 100)
    const terrain = sectors.map((sector) => ({ ...sector, stepMs: 400 }))
    motion.update(view(approved(1, [step(2)]), terrain), 100)
    expect(motion.sample('remote', 200)).toEqual({ x: 1.5, y: 1.5 })
    expect(motion.moving(200)).toBe(false)
  })
  it('closes a newly withheld route even when the accompanying player clock is stale', () => {
    const motion = new WorldPlayerMotion(view(approved(1, [step(2)], 1000, 1200, 5)), 0)
    motion.sample('remote', 100)
    const terrain = sectors.map((sector) => ({
      ...sector,
      cells: sector.cells.filter((cell) => !(cell.x === 2 && cell.y === 1)),
    }))
    motion.update(view(approved(1, [], 1100, null, 4), terrain), 100)
    expect(motion.sample('remote', 200)).toEqual({ x: 1.5, y: 1.5 })
    expect(motion.moving(200)).toBe(false)
  })
  it('fails closed for malformed client-side route coordinates', () => {
    const route = [{ ...step(2), position: { sectorId: 'a', x: '2', y: 1 } }]
    const motion = new WorldPlayerMotion(
      view(
        Object.assign(player(1), {
          movement: { version: 1, serverNow: 1000, nextStepAt: 1200, route },
        }),
      ),
      0,
    )
    expect(motion.sample('remote', 100)).toEqual({ x: 1.5, y: 1.5 })
    expect(motion.moving(100)).toBe(false)
  })
  it('stops at withheld, nonwalkable, disconnected or wrong-duration approved steps', () => {
    for (const tail of [
      step(8),
      step(3, 1, 201),
      { ...step(3), position: { sectorId: 'missing', x: 3, y: 1 } },
    ]) {
      const motion = new WorldPlayerMotion(view(approved(1, [step(2), tail])), 0)
      expect(motion.sample('remote', 600)).toEqual({ x: 2.5, y: 1.5 })
    }
    const motion = new WorldPlayerMotion(view(approved(1, [step(2), step(3)])), 0)
    const terrain = sectors.map((sector) => ({
      ...sector,
      cells: sector.cells.filter((cell) => !(cell.x === 2 && cell.y === 1)),
    }))
    motion.update(view(approved(1, [step(2), step(3)]), terrain), 100)
    expect(motion.sample('remote', 100)).toEqual({ x: 1.5, y: 1.5 })
    expect(motion.moving(100)).toBe(false)
  })
  it('crosses a supplied longitude seam on its approved authored clock', () => {
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
    const person = Object.assign(player(0), {
      position: west,
      movement: {
        version: 1,
        serverNow: 1200,
        nextStepAt: 1400,
        route: [{ position: east, durationMs: 400 }],
      },
    })
    const motion = new WorldPlayerMotion(view(person, terrain), 0)
    expect(motion.sample('remote', 0)!.x).toBe(1664)
    expect(motion.sample('remote', 200)!.x).toBe(1664.5)
    expect(motion.sample('remote', 200, { x: 0, y: 4 })!.x).toBe(0.5)
  })
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
