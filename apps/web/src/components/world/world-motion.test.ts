import { describe, expect, it } from 'vitest'
import { advanceWorldRoute, MOVEMENT_LAG_ALLOWANCE_MS, newWorldState } from '@/world/travel'
import type { TravelStep, WorldSectorView, WorldView } from '@/world/types'
import { localRoute, WorldMotion } from './world-motion'
const position = { sectorId: 'a', x: 1, y: 4 }
const sectors: WorldSectorView[] = [
  {
    id: 'a',
    name: 'Test ground',
    coordinate: 'Test ground',
    regionId: 'verdant-expanse',
    art: null,
    east: 0,
    north: 0,
    charted: false,
    landmarks: [],
    atlasColumn: 0,
    atlasRow: 0,
    exits: [],
    cells: Array.from({ length: 117 }, (_, i) => ({
      x: i % 13,
      y: Math.floor(i / 13),
      terrain: '.',
      walkable: true,
      safe: false,
    })),
  },
]
const view = { position, sectors, route: [] } as unknown as WorldView
const route = [2, 3, 4].map((x) => ({ position: { ...position, x }, durationMs: 200 }))
describe('world visual motion', () => {
  const forward = [2, 3, 4, 5, 6, 7, 8, 9].map((x) => ({
    position: { ...position, x },
    durationMs: 200,
  }))
  const receipt = (steps = forward, overrides: Partial<WorldView> = {}): WorldView => ({
    ...view,
    characterId: 'owner',
    version: 2,
    serverNow: 1000,
    nextStepAt: steps.length ? 1200 : null,
    movementBlocked: null,
    battleSessionId: null,
    route: steps,
    ...overrides,
  })
  it('keeps an approved common route moving while a repeated click waits for confirmation', () => {
    const motion = new WorldMotion(view)
    motion.reconcile(receipt(), 0)
    motion.plan(forward, sectors, 400)
    expect(motion.sample(1001).moving).toBe(true)
    expect(motion.sample(1200).point.x).toBeCloseTo(7.5)
    expect(motion.sample(1600).position).toEqual(forward.at(-1)!.position)
  })
  it('spends the preview budget only on the new suffix after an approved common prefix', () => {
    const motion = new WorldMotion(view)
    motion.reconcile(receipt(forward.slice(0, 5)), 0)
    motion.plan(forward, sectors, 100)
    expect(motion.sample(1000).position).toEqual(forward[4]!.position)
    expect(motion.sample(1500).moving).toBe(true)
    expect(motion.sample(1600).position).toEqual(forward[7]!.position)
    const longer = [...forward, { position: { ...position, x: 10 }, durationMs: 200 }]
    const bounded = new WorldMotion(view)
    bounded.reconcile(receipt(forward.slice(0, 5)), 0)
    bounded.plan(longer, sectors, 100)
    expect(bounded.sample(5000).position).toEqual(forward[7]!.position)
  })
  it('ends a shorter common-prefix plan at its requested destination', () => {
    const motion = new WorldMotion(view)
    motion.reconcile(receipt(), 0)
    motion.plan(forward.slice(0, 2), sectors, 100)
    expect(motion.sample(400).position).toEqual(forward[1]!.position)
    expect(motion.sample(2000).position).toEqual(forward[1]!.position)
    expect(motion.sample(2000).moving).toBe(false)
  })
  it('drops an obsolete approved tail after a divergent turn and bounds the new preview', () => {
    const motion = new WorldMotion(view)
    motion.reconcile(receipt(), 0)
    const turn = [
      forward[0]!,
      ...[3, 2, 1, 0].map((y) => ({
        position: { ...position, x: 2, y },
        durationMs: 200,
      })),
    ]
    motion.plan(turn, sectors, 100)
    expect(motion.sample(700).moving).toBe(true)
    expect(motion.sample(800).position).toEqual({ ...position, x: 2, y: 1 })
    expect(motion.sample(3000).position).toEqual({ ...position, x: 2, y: 1 })
    expect(motion.sample(3000).moving).toBe(false)
  })
  it('retains a partial approved slow-terrain interval through repeated plans', () => {
    const slow = forward.map((step) => ({ ...step, durationMs: 400 }))
    const slowSectors = sectors.map((sector) => ({ ...sector, stepMs: 400 }))
    const motion = new WorldMotion({ ...view, sectors: slowSectors })
    motion.reconcile(receipt(slow, { sectors: slowSectors, nextStepAt: 1400 }), 0)
    motion.plan(slow, slowSectors, 350)
    expect(motion.sample(1600).point.x).toBeCloseTo(5.5)
    expect(motion.sample(3000).moving).toBe(true)
    expect(motion.sample(3200).position).toEqual(slow.at(-1)!.position)
  })
  it('keeps the 600ms first-preview bound while early approval removes a 950ms reply gap', () => {
    const delayed = new WorldMotion(view),
      fast = new WorldMotion(view)
    delayed.plan(forward, sectors, 0)
    fast.plan(forward, sectors, 0)
    fast.reconcile(receipt(), 250)
    expect(delayed.sample(600).moving).toBe(false)
    expect(delayed.sample(949).moving).toBe(false)
    expect(fast.sample(600).moving).toBe(true)
    expect(fast.sample(949).moving).toBe(true)
    delayed.reconcile(receipt(), 950)
    expect(delayed.sample(951).moving).toBe(true)
  })
  it('bootstraps the approved first-step clock at an explicit performance origin', () => {
    const motion = new WorldMotion(receipt(forward, { nextStepAt: 1050 }), 5000)
    expect(motion.sample(5000).point.x).toBeCloseTo(2.25)
    expect(motion.sample(5050).position).toEqual(forward[0]!.position)
    expect(motion.sample(5250).position).toEqual(forward[1]!.position)
    expect(motion.approvedPosition(5049)).toEqual(position)
    expect(motion.approvedPosition(5050)).toEqual(forward[0]!.position)
    expect(motion.nextApprovedTransitionDelay(5000)).toBe(50)
  })
  it('bootstraps already-due approved prefixes and keeps ordinary reconciliation continuous', () => {
    const confirmed = receipt(forward, { nextStepAt: 550 })
    const bootstrap = new WorldMotion(confirmed, 5000)
    expect(bootstrap.approvedPositionAtReceipt()).toEqual(forward[2]!.position)
    expect(bootstrap.sample(5000).position).toEqual(forward[2]!.position)
    expect(bootstrap.nextApprovedTransitionDelay(5000)).toBe(150)
    const motion = new WorldMotion(view)
    motion.plan(forward, sectors, 0)
    const before = motion.sample(100).point
    motion.reconcile(confirmed, 100)
    expect(motion.sample(100).point).toEqual(before)
    expect(motion.sample(116).point.x - before.x).toBeCloseTo(16 / 200)
    expect(motion.approvedPosition(100)).toEqual(forward[2]!.position)
    expect(motion.approvedPosition(250)).toEqual(forward[3]!.position)
  })
  it.each([200, 400])(
    'keeps a %d ms approved turn on phase through current-clock receipts and replacement clicks',
    (durationMs) => {
      const turn = [
        { ...position, x: 2 },
        { ...position, x: 2, y: 3 },
        { ...position, x: 3, y: 3 },
        { ...position, x: 4, y: 3 },
      ].map((position) => ({ position, durationMs }))
      const terrain = sectors.map((sector) => ({ ...sector, stepMs: durationMs }))
      const confirmed = receipt(turn, { sectors: terrain, nextStepAt: 1050 })
      const reference = new WorldMotion(confirmed, 5000)
      const motion = new WorldMotion(confirmed, 5000)
      const final = 5050 + 3 * durationMs
      for (let now = 5000; now <= final; now++) {
        const elapsed = now - 5000
        if (elapsed % 23 === 0) motion.reconcile({ ...confirmed, serverNow: 1000 + elapsed }, now)
        if (elapsed % 41 === 0) motion.plan(turn, terrain, now)
        for (const axis of ['x', 'y'] as const)
          expect(motion.sample(now).point[axis], `at ${elapsed}ms ${axis}`).toBeCloseTo(
            reference.sample(now).point[axis],
            8,
          )
        expect(motion.approvedPosition(now)).toEqual(reference.approvedPosition(now))
      }
      expect(motion.sample(final).moving).toBe(false)
    },
  )
  it('keeps approved arrival helpers independent of preview replacements and local stops', () => {
    const motion = new WorldMotion(receipt(), 5000)
    const turn = [{ position: { ...position, y: 5 }, durationMs: 200 }]
    motion.plan(turn, sectors, 5010)
    motion.stop(5100)
    expect(motion.sample(5500).moving).toBe(false)
    expect(motion.approvedPosition(5200)).toEqual(forward[0]!.position)
    motion.reconcile(receipt([], { position: forward[0]!.position, serverNow: 1200 }), 5200)
    expect(motion.approvedPosition(9000)).toEqual(forward[0]!.position)
    expect(motion.nextApprovedTransitionDelay(5200)).toBeNull()
    expect(motion.loadedHorizonMs(5200)).toBe(0)
  })
  it('updates an accepted superseded receipt clock without replacing the newer visual plan', () => {
    const motion = new WorldMotion(view)
    motion.plan(forward, sectors, 0)
    const turn = [
      { ...position, x: 2, y: 4 },
      { ...position, x: 2, y: 3 },
      { ...position, x: 2, y: 2 },
    ].map((position) => ({ position, durationMs: 200 }))
    motion.plan(turn, sectors, 100)
    const before = motion.sample(150)
    motion.approveReceipt(receipt(forward, { serverNow: 1100, nextStepAt: 1200 }), 150)
    expect(motion.sample(150)).toEqual(before)
    expect(motion.sample(250).point.y).toBeLessThan(before.point.y)
    expect(motion.sample(800).position).toEqual(turn.at(-1)!.position)
    expect(motion.approvedPositionAtReceipt()).toEqual(position)
    expect(motion.approvedPosition(250)).toEqual(forward[0]!.position)
    expect(motion.nextApprovedTransitionDelay(150)).toBe(100)
    expect(motion.loadedHorizonMs(150)).toBe(1500)
  })
  it('uses an accepted superseded receipt as provenance for a later common-prefix plan', () => {
    const motion = new WorldMotion(view)
    motion.plan(forward, sectors, 0)
    motion.approveReceipt(receipt(), 100)
    motion.plan(forward, sectors, 200)
    expect(motion.sample(1200).moving).toBe(true)
    expect(motion.sample(1600).position).toEqual(forward.at(-1)!.position)
  })
  it('keeps approval-only receipts from appending to the displayed route before explicit scene hydration', () => {
    const from = { ...position, x: 11 },
      edge = { ...position, x: 12 }
    const to = { sectorId: 'b', x: 0, y: 4 }
    const first = {
      ...sectors[0]!,
      exits: [{ from: edge, to, durationMs: 200, name: 'Known crossing' }],
    }
    const second = { ...sectors[0]!, id: 'b', atlasColumn: 1 }
    const crossing = [edge, to].map((position) => ({ position, durationMs: 200 }))
    const confirmed = receipt(crossing, { position: from, sectors: [first], nextStepAt: 1050 })
    const motion = new WorldMotion(confirmed, 5000)
    motion.approveReceipt({ ...confirmed, sectors: [first, second], serverNow: 1025 }, 5025)
    expect(motion.sample(5300).position).toEqual(edge)
    expect(motion.approvedPosition(5300)).toEqual(to)
  })
  it('expands loaded approved terrain without resetting its captured clock or current visual plan', () => {
    const from = { ...position, x: 11 },
      edge = { ...position, x: 12 }
    const to = { sectorId: 'b', x: 0, y: 4 },
      end = { ...to, x: 1 }
    const first = {
      ...sectors[0]!,
      exits: [{ from: edge, to, durationMs: 200, name: 'Known crossing' }],
    }
    const second = { ...sectors[0]!, id: 'b', atlasColumn: 1 }
    const crossing = [edge, to, end].map((position) => ({ position, durationMs: 200 }))
    const motion = new WorldMotion(
      receipt(crossing, {
        position: from,
        sectors: [first],
        nextStepAt: 1050,
      }),
      5000,
    )
    const before = motion.sample(5025)
    expect(motion.loadedHorizonMs(5025)).toBe(25)
    expect(motion.nextApprovedTransitionDelay(5025)).toBe(25)
    motion.updateScene([first, second])
    expect(motion.sample(5025)).toEqual(before)
    expect(motion.sample(5300).position).toEqual(to)
    expect(motion.approvedPositionAtReceipt()).toEqual(from)
    expect(motion.approvedPosition(5025)).toEqual(from)
    expect(motion.nextApprovedTransitionDelay(5025)).toBe(25)
    expect(motion.loadedHorizonMs(5025)).toBe(425)
    expect(motion.approvedPosition(5250)).toEqual(to)
    expect(motion.approvedPosition(5450)).toEqual(end)
    motion.updateScene([first])
    expect(motion.loadedHorizonMs(5025)).toBe(25)
    expect(motion.approvedPosition(5450)).toEqual(edge)
  })
  it('leaves a newer divergent visual preview untouched when authorized geometry arrives', () => {
    const from = { ...position, x: 11 },
      edge = { ...position, x: 12 }
    const to = { sectorId: 'b', x: 0, y: 4 }
    const first = {
      ...sectors[0]!,
      exits: [{ from: edge, to, durationMs: 200, name: 'Known crossing' }],
    }
    const second = { ...sectors[0]!, id: 'b', atlasColumn: 1 }
    const crossing = [edge, to].map((position) => ({ position, durationMs: 200 }))
    const motion = new WorldMotion(
      receipt(crossing, {
        position: from,
        sectors: [first],
        nextStepAt: 1050,
      }),
      5000,
    )
    const turn = [edge, { ...edge, y: 3 }].map((position) => ({ position, durationMs: 200 }))
    motion.plan(turn, [first], 5025)
    const before = motion.sample(5025)
    motion.updateScene([first, second])
    expect(motion.sample(5025)).toEqual(before)
    expect(motion.sample(5300).position).toEqual(turn.at(-1)!.position)
    expect(motion.sample(6000).position).toEqual(turn.at(-1)!.position)
  })
  it('does not append an obsolete approved tail after a shorter common-prefix target or stop', () => {
    const from = { ...position, x: 11 },
      edge = { ...position, x: 12 }
    const to = { sectorId: 'b', x: 0, y: 4 }
    const first = {
      ...sectors[0]!,
      exits: [{ from: edge, to, durationMs: 200, name: 'Known crossing' }],
    }
    const second = { ...sectors[0]!, id: 'b', atlasColumn: 1 }
    const crossing = [edge, to].map((position) => ({ position, durationMs: 200 }))
    for (const stop of [false, true]) {
      const motion = new WorldMotion(
        receipt(crossing, {
          position: from,
          sectors: [first],
          nextStepAt: 1050,
        }),
        5000,
      )
      if (stop) motion.stop(5025)
      else motion.plan(crossing.slice(0, 1), [first], 5025)
      const before = motion.sample(5025)
      motion.updateScene([first, second])
      expect(motion.sample(5025)).toEqual(before)
      expect(motion.sample(6000).position).toEqual(stop ? from : edge)
      expect(motion.sample(6000).moving).toBe(false)
    }
  })
  it('does not jump over an already observed visual pause when loaded geometry arrives late', () => {
    const from = { ...position, x: 11 },
      edge = { ...position, x: 12 }
    const to = { sectorId: 'b', x: 0, y: 4 }
    const first = {
      ...sectors[0]!,
      exits: [{ from: edge, to, durationMs: 200, name: 'Known crossing' }],
    }
    const second = { ...sectors[0]!, id: 'b', atlasColumn: 1 }
    const crossing = [edge, to].map((position) => ({ position, durationMs: 200 }))
    const confirmed = receipt(crossing, { position: from, sectors: [first], nextStepAt: 1050 })
    const motion = new WorldMotion(confirmed, 5000)
    const before = motion.sample(5200)
    expect(before.moving).toBe(false)
    motion.updateScene([first, second])
    expect(motion.sample(5200)).toEqual(before)
    motion.reconcile({ ...confirmed, sectors: [first, second], serverNow: 1200 }, 5200)
    expect(motion.sample(5200).point).toEqual(before.point)
    expect(motion.sample(5216).point.x - before.point.x).toBeCloseTo(16 / 200)
    expect(motion.sample(5400).position).toEqual(to)
  })
  it.each(['sector', 'cell', 'road'] as const)(
    'trims a now-withheld future visual %s without changing the current point or authored phase',
    (withheld) => {
      const from = { ...position, x: 11 },
        edge = { ...position, x: 12 }
      const to = { sectorId: 'b', x: 0, y: 4 },
        end = { ...to, x: 1 }
      const first = {
        ...sectors[0]!,
        exits: [{ from: edge, to, durationMs: 200, name: 'Known crossing' }],
      }
      const second = { ...sectors[0]!, id: 'b', atlasColumn: 1 }
      const crossing = [edge, to, end].map((position) => ({ position, durationMs: 200 }))
      const motion = new WorldMotion(
        receipt(crossing, {
          position: from,
          sectors: [first],
          nextStepAt: 1050,
        }),
        5000,
      )
      motion.updateScene([first, second], 5010)
      const before = motion.sample(5025)
      const narrowed =
        withheld === 'sector'
          ? [first]
          : withheld === 'cell'
            ? [
                first,
                { ...second, cells: second.cells.filter((cell) => cell.x !== 0 || cell.y !== 4) },
              ]
            : [{ ...first, exits: [] }, second]
      motion.updateScene(narrowed, 5025)
      expect(motion.sample(5025)).toEqual(before)
      expect(motion.sample(5049).point.x).toBeCloseTo(12.5 - 1 / 200)
      expect(motion.sample(5050).position).toEqual(edge)
      expect(motion.sample(5450).position).toEqual(edge)
      expect(motion.sample(5450).moving).toBe(false)
    },
  )
  it('freezes an in-progress step when private geometry is withheld instead of rewinding it', () => {
    const motion = new WorldMotion(receipt(), 5000)
    const before = motion.sample(5100)
    const privateGeometry = sectors.map((sector) => ({
      ...sector,
      cells: sector.cells.filter((cell) => cell.x !== 2 || cell.y !== 4),
    }))
    motion.updateScene(privateGeometry, 5100)
    expect(motion.sample(5100).point).toEqual(before.point)
    expect(motion.sample(5200).point).toEqual(before.point)
    expect(motion.sample(9000).position).toEqual(before.position)
    expect(motion.sample(9000).moving).toBe(false)
    expect(motion.approvedPosition(9000)).toEqual(position)
  })
  it('retains an ordinary known-tile centering preview through unchanged scene hydration', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, sectors, 0)
    motion.plan([], sectors, 100)
    const before = motion.sample(100).point
    motion.updateScene(sectors, 100)
    expect(motion.sample(100).point).toEqual(before)
    expect(motion.sample(200).point).toEqual({ x: 1.5, y: 4.5 })
    expect(motion.sample(200).moving).toBe(false)
  })
  it.each(['backward', 'turn', 'correction'] as const)(
    'keeps authored speed through unchanged hydration during a partial %s interval',
    (path) => {
      const motion = new WorldMotion(view),
        reference = new WorldMotion(view)
      for (const candidate of [motion, reference]) {
        candidate.plan(route, sectors, 0)
        if (path === 'correction')
          candidate.reconcile({ ...view, position: { ...position, x: 4 } }, 100)
        else
          candidate.plan(
            [
              {
                position: path === 'backward' ? { ...position, x: 0 } : { ...position, y: 3 },
                durationMs: 200,
              },
            ],
            sectors,
            100,
          )
      }
      const before = motion.sample(116)
      expect(before.moving).toBe(true)
      motion.updateScene(sectors, 116)
      expect(motion.sample(116)).toEqual(before)
      for (let now = 132; now <= 700; now += 16) {
        expect(motion.sample(now)).toEqual(reference.sample(now))
      }
      if (path === 'backward') expect(motion.sample(200).point.x).toBeCloseTo(1.5)
      expect(motion.sample(700).moving).toBe(false)
    },
  )
  it('freezes an omitted canonical-sector receipt at the exact current visual point', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, sectors, 0)
    const before = motion.sample(100)
    motion.reconcile(
      {
        ...view,
        position: { sectorId: 'unloaded', x: 0, y: 4 },
        route: [],
        serverNow: 1000,
        nextStepAt: null,
      },
      100,
    )
    expect(motion.sample(100).point).toEqual(before.point)
    expect(motion.sample(500).point).toEqual(before.point)
    expect(motion.sample(500).position).toEqual(before.position)
    expect(motion.sample(500).moving).toBe(false)
  })
  it.each([MOVEMENT_LAG_ALLOWANCE_MS, MOVEMENT_LAG_ALLOWANCE_MS + 1])(
    'matches authoritative bootstrap catch-up limits for a receipt %d ms after its first deadline',
    (late) => {
      // Traverse a legal serpentine path, supplying every loaded cell.
      const path: TravelStep[] = []
      let cursor = { ...position }
      for (let y = 4; y >= 0; y--) {
        const xs =
          y % 2 === 0
            ? Array.from({ length: 11 }, (_, i) => i + 2)
            : Array.from({ length: 11 }, (_, i) => 12 - i)
        if (y !== 4) path.push({ position: { ...cursor, y }, durationMs: 200 })
        for (const x of xs) {
          if (x === cursor.x) continue
          cursor = { ...cursor, x, y }
          path.push({ position: cursor, durationMs: 200 })
        }
      }
      expect(path.length).toBeGreaterThan(40)
      const snapshot = receipt(path, { serverNow: 10000, nextStepAt: 10000 - late })
      const expected = advanceWorldRoute(
        {
          ...newWorldState(),
          position,
          route: path,
          nextStepAt: snapshot.nextStepAt,
        },
        snapshot.serverNow,
      )
      const motion = new WorldMotion(snapshot, 5000)
      expect(motion.approvedPositionAtReceipt()).toEqual(expected.position)
      expect(motion.sample(5000).position).toEqual(expected.position)
      expect(motion.approvedPosition(5000)).toEqual(expected.position)
      if (late > MOVEMENT_LAG_ALLOWANCE_MS) {
        expect(motion.nextApprovedTransitionDelay(5000)).toBe(200)
        expect(motion.approvedPosition(5199)).toEqual(expected.position)
        expect(motion.approvedPosition(5200)).toEqual(path[1]!.position)
      }
    },
  )
  it('keeps scene hydration from creating a clock or reopening a blocked receipt', () => {
    const legacy = new WorldMotion({ ...view, route: forward })
    legacy.updateScene(sectors)
    expect(legacy.approvedPosition(9000)).toEqual(position)
    expect(legacy.loadedHorizonMs(0)).toBe(0)
    const blocked = new WorldMotion(receipt(forward, { movementBlocked: 'Blocked' }), 5000)
    blocked.updateScene(sectors)
    expect(blocked.approvedPosition(9000)).toEqual(position)
    expect(blocked.loadedHorizonMs(5000)).toBe(0)
  })
  it.each(['movementBlocked', 'battleSessionId'] as const)(
    'freezes approved position and deadlines on a %s receipt',
    (field) => {
      const motion = new WorldMotion(receipt(), 5000)
      motion.reconcile(receipt(forward, { [field]: 'blocked' }), 5100)
      expect(motion.approvedPosition(9000)).toEqual(position)
      expect(motion.sample(5116).moving).toBe(false)
      expect(motion.nextApprovedTransitionDelay(5100)).toBeNull()
      expect(motion.loadedHorizonMs(5100)).toBe(0)
      motion.plan(forward, sectors, 5200)
      expect(motion.sample(5216).moving).toBe(false)
    },
  )
  it('bounds approved UI arrivals and loaded horizon at the first withheld walkable cell', () => {
    const restricted = sectors.map((sector) => ({
      ...sector,
      cells: sector.cells.filter((cell) => cell.x !== 4 || cell.y !== 4),
    }))
    const motion = new WorldMotion(receipt(forward, { sectors: restricted }), 5000)
    expect(motion.loadedHorizonMs(5000)).toBe(400)
    expect(motion.loadedHorizonMs(5300)).toBe(100)
    expect(motion.approvedPosition(9000)).toEqual(forward[1]!.position)
    expect(motion.nextApprovedTransitionDelay(5400)).toBeNull()
  })
  it('does not derive approved position from unloaded or historical clockless route cells', () => {
    const unloaded: TravelStep[] = [
      forward[0]!,
      {
        position: { sectorId: 'unloaded', x: 0, y: 4 },
        durationMs: 200,
      },
    ]
    const motion = new WorldMotion(receipt(unloaded), 5000)
    expect(motion.loadedHorizonMs(5000)).toBe(200)
    expect(motion.approvedPosition(9000)).toEqual(forward[0]!.position)
    const legacy = new WorldMotion({ ...view, route: forward })
    expect(legacy.approvedPosition(9000)).toEqual(position)
    expect(legacy.nextApprovedTransitionDelay(0)).toBeNull()
  })
  it('does not derive an arrival from unsupplied roads or invalid deadline clocks', () => {
    const disconnected = [{ position: { ...position, x: 5 }, durationMs: 200 }]
    const motion = new WorldMotion(receipt(disconnected), 5000)
    expect(motion.approvedPosition(9000)).toEqual(position)
    expect(motion.loadedHorizonMs(5000)).toBe(0)
    for (const nextStepAt of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1300]) {
      const invalid = new WorldMotion(receipt(forward, { nextStepAt }), 5000)
      expect(invalid.approvedPosition(9000)).toEqual(position)
      expect(invalid.nextApprovedTransitionDelay(5000)).toBeNull()
    }
  })
  it('follows a supplied approved longitude seam with the authored crossing deadline', () => {
    const from = { sectorId: 'west', x: 12, y: 4 },
      to = { sectorId: 'east', x: 0, y: 4 }
    const seamSectors = [
      {
        ...sectors[0]!,
        id: 'west',
        atlasColumn: 127,
        atlasRow: 32,
        charted: true,
        exits: [{ from, to, durationMs: 400, name: 'Cross' }],
      },
      { ...sectors[0]!, id: 'east', atlasColumn: 0, atlasRow: 32, charted: true },
    ]
    const crossing = [{ position: to, durationMs: 400 }]
    const motion = new WorldMotion(
      receipt(crossing, {
        position: from,
        sectors: seamSectors,
        nextStepAt: 1100,
      }),
      5000,
    )
    expect(motion.sample(5000).point.x).toBeCloseTo(1664.25)
    expect(motion.approvedPosition(5099)).toEqual(from)
    expect(motion.approvedPosition(5100)).toEqual(to)
    expect(motion.loadedHorizonMs(5000)).toBe(100)
    motion.plan(crossing, seamSectors, 5020)
    expect(motion.sample(5100).position).toEqual(to)
  })
  it('does not interpolate an omitted source sector through overlapping public ground', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const replacement = { ...view.sectors[0]!, id: 'public-overlay', charted: true }
    const confirmed = [
      [2, 4],
      [2, 3],
      [3, 3],
      [3, 2],
      [3, 1],
      [4, 1],
    ].map(([x, y]) => ({
      position: { sectorId: replacement.id, x: x!, y: y! },
      durationMs: 200,
    }))
    motion.reconcile(
      {
        ...view,
        position: { ...position, sectorId: replacement.id },
        sectors: [replacement],
        route: confirmed,
      },
      650,
    )
    expect(motion.sample(650).point).toEqual({ x: 1.5, y: 4.5 })
  })
  it('does not borrow overlapping public ground when the private preview source is withheld', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const privateSector = {
      ...view.sectors[0]!,
      charted: false,
      cells: view.sectors[0]!.cells.filter((cell) => cell.x !== 4 || cell.y !== 4),
    }
    const overlay = {
      ...view.sectors[0]!,
      id: 'public-overlay',
      charted: true,
      exits: [
        {
          from: { sectorId: 'public-overlay', x: 4, y: 4 },
          to: { ...position, x: 4, y: 3 },
          durationMs: 200,
          name: 'Overlap',
        },
      ],
    }
    const confirmed = [
      [2, 4],
      [2, 3],
      [3, 3],
      [3, 2],
      [3, 1],
      [4, 1],
    ].map(([x, y]) => ({ position: { ...position, x: x!, y: y! }, durationMs: 200 }))
    motion.reconcile({ ...view, sectors: [privateSector, overlay], route: confirmed }, 650)
    expect(motion.sample(650).point).toEqual({ x: 1.5, y: 4.5 })
  })
  it('continues toward a distant click when a delayed receipt confirms a different legal path', () => {
    const motion = new WorldMotion(view)
    const preview = [
      [2, 4],
      [3, 4],
      [4, 4],
      [4, 3],
      [4, 2],
      [4, 1],
    ].map(([x, y]) => ({ position: { ...position, x: x!, y: y! }, durationMs: 200 }))
    const confirmed = [
      [2, 4],
      [2, 3],
      [3, 3],
      [3, 2],
      [3, 1],
      [4, 1],
    ].map(([x, y]) => ({ position: { ...position, x: x!, y: y! }, durationMs: 200 }))
    motion.plan(preview, view.sectors, 0)
    const before = motion.sample(650).point
    motion.reconcile({ ...view, route: confirmed }, 650)
    expect(motion.sample(650).point).toEqual(before)
    expect(motion.sample(666).point.x).toBeCloseTo(before.x)
    expect(motion.sample(666).point.y).toBeLessThan(before.y)
    expect(motion.sample(1250)).toEqual({
      point: { x: 4.5, y: 1.5 },
      position: preview.at(-1)!.position,
      moving: false,
    })
  })
  it('settles an already reached destination without revisiting the preceding tile', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(425).point
    motion.plan(route.slice(0, 2), view.sectors, 425)
    expect(motion.sample(425).point).toEqual(before)
    expect(motion.sample(525)).toEqual({
      point: { x: 3.5, y: 4.5 },
      position: route[1]!.position,
      moving: false,
    })
  })
  it('settles a click on the current tile centre instead of freezing between tiles', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(100).point
    // A click on the tile currently occupied yields a valid zero-step route.
    motion.plan([], view.sectors, 100)
    expect(motion.sample(100).point).toEqual(before)
    expect(motion.sample(116).point.x).toBeCloseTo(before.x - 16 / 200)
    expect(motion.sample(250)).toEqual({
      point: { x: 1.5, y: 4.5 },
      position,
      moving: false,
    })
  })
  it('uses the remaining preview time to keep a slow-terrain click moving to its full destination', () => {
    const motion = new WorldMotion(view)
    const slow = route.map((step) => ({ ...step, durationMs: 400 }))
    motion.plan(slow, view.sectors, 0)
    const before = motion.sample(350).point
    motion.plan(slow, view.sectors, 350)
    expect(motion.sample(350).point).toEqual(before)
    expect(motion.sample(800).point.x).toBeCloseTo(3.5)
    motion.reconcile({ ...view, position: slow[1]!.position, route: slow.slice(2) }, 900)
    expect(motion.sample(1400)).toEqual({
      point: { x: 4.5, y: 4.5 },
      position: slow.at(-1)!.position,
      moving: false,
    })
  })
  it.each([
    { durationMs: 200, nextArrival: 400 },
    { durationMs: 400, nextArrival: 815 },
  ])(
    'does not backtrack when a route calculation crosses a $durationMs ms tile deadline',
    ({ durationMs, nextArrival }) => {
      const motion = new WorldMotion(view)
      const forward = [2, 3, 4, 5, 6].map((x) => ({
        position: { ...position, x },
        durationMs,
      }))
      motion.plan(forward, view.sectors, 0)
      // The route was calculated just before landing on x=2, but is applied
      // after that boundary. Its first tile has already been traversed.
      const now = durationMs + 15
      const before = motion.sample(now).point
      motion.plan(forward, view.sectors, now)
      expect(motion.sample(now).point).toEqual(before)
      expect(motion.sample(now + 16).point.x).toBeGreaterThan(before.x)
      expect(motion.sample(nextArrival).point.x).toBeCloseTo(3.5)
      motion.reconcile({ ...view, route: forward }, now + 40)
      let previous = motion.sample(now + 40).point.x
      const finalArrival = nextArrival + durationMs * 3
      for (let time = now + 56; time <= finalArrival; time += 16) {
        const point = motion.sample(time).point.x
        expect(point - previous).toBeGreaterThanOrEqual(0)
        expect(point - previous).toBeLessThanOrEqual(16 / durationMs + 0.0001)
        previous = point
      }
      expect(motion.sample(finalArrival).position).toEqual(forward.at(-1)!.position)
    },
  )
  it('keeps cached routes isolated when a later terrain snapshot withholds a connecting cell', () => {
    const corridor = {
      ...view,
      sectors: view.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.filter((cell) => cell.y === 4 && cell.x >= 1 && cell.x <= 3),
      })),
    }
    const destination = { ...position, x: 3 }
    expect(localRoute(corridor, position, destination)?.map((step) => step.position.x)).toEqual([
      2, 3,
    ])
    const restricted = {
      ...corridor,
      sectors: corridor.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.filter((cell) => cell.x !== 2),
      })),
    }
    expect(localRoute(restricted, position, destination)).toBeNull()
    expect(localRoute(corridor, position, destination)).toHaveLength(2)
  })
  it('preserves the authored arrival deadline when a forward preview is replanned mid-step', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(100).point
    motion.plan(route, view.sectors, 100)
    expect(motion.sample(100).point).toEqual(before)
    expect(motion.sample(150).point.x).toBeCloseTo(2.25)
    expect(motion.sample(200).point.x).toBeCloseTo(2.5)
    expect(motion.sample(400).point.x).toBeCloseTo(3.5)
  })
  it('keeps slow authored pace through repeated plans and delayed forward receipts', () => {
    const motion = new WorldMotion(view)
    const slow = [2, 3].map((x) => ({ position: { ...position, x }, durationMs: 400 }))
    motion.plan(slow, view.sectors, 0)
    motion.plan(slow, view.sectors, 100)
    expect(motion.sample(400).point.x).toBeCloseTo(2.5)
    motion.reconcile({ ...view, route: slow }, 250)
    let previous = motion.sample(250).point.x
    for (let now = 266; now <= 800; now += 16) {
      const point = motion.sample(now).point.x
      expect(point - previous).toBeGreaterThanOrEqual(0)
      expect(point - previous).toBeLessThanOrEqual(16 / 400 + 0.0001)
      previous = point
    }
    expect(motion.sample(800).point.x).toBeCloseTo(3.5)
  })
  it('settles a final authoritative arrival without jumping from a slower preview', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(500).point
    motion.reconcile({ ...view, position: route[2]!.position }, 500)
    expect(motion.sample(500).point).toEqual(before)
    expect(motion.sample(516).point.x - before.x).toBeLessThan(0.1)
    expect(motion.sample(800)).toEqual({
      point: { x: 4.5, y: 4.5 },
      position: route[2]!.position,
      moving: false,
    })
  })
  it('keeps a drained preview continuous when a later confirmation has advanced beyond it', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(1600).point
    motion.reconcile(
      {
        ...view,
        position: { ...position, x: 7 },
        route: [{ position: { ...position, x: 8 }, durationMs: 200 }],
      },
      1600,
    )
    expect(motion.sample(1600).point).toEqual(before)
    expect(motion.sample(1616).point.x - before.x).toBeCloseTo(0.08)
    expect(motion.sample(3000).point.x).toBe(8.5)
  })
  it('keeps confirmed terrain step durations after a mid-step receipt', () => {
    const motion = new WorldMotion(view)
    const slow = route.map((step) => ({ ...step, durationMs: 400 }))
    motion.reconcile({ ...view, route: slow }, 0)
    motion.reconcile({ ...view, route: slow }, 100)
    expect(motion.sample(400).point.x).toBeCloseTo(2.5)
    expect(motion.sample(800).point.x).toBeCloseTo(3.5)
  })
  it('settles a delayed receipt along known walkable terrain around a water tile', () => {
    const waterView = {
      ...view,
      sectors: view.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.map((cell) =>
          cell.x === 5 && cell.y === 4 ? { ...cell, terrain: '~', walkable: false } : cell,
        ),
      })),
    }
    const motion = new WorldMotion(waterView)
    motion.plan(route, waterView.sectors, 0)
    const before = motion.sample(1600).point
    motion.reconcile({ ...waterView, position: { ...position, x: 7 } }, 1600)
    expect(motion.sample(1600).point).toEqual(before)
    for (let now = 1600; now <= 3200; now += 20) {
      const sample = motion.sample(now)
      expect(Math.floor(sample.point.x) === 5 && Math.floor(sample.point.y) === 4).toBe(false)
    }
    expect(motion.sample(3200).position).toEqual({ ...position, x: 7 })
  })
  it('previews and reconciles an eastbound longitude crossing as one tile without a visual rewind', () => {
    const seamView = {
      ...view,
      position: { sectorId: 'west', x: 12, y: 4 },
      sectors: [
        { id: 'west', atlasColumn: 127, atlasRow: 32, charted: true },
        { id: 'east', atlasColumn: 0, atlasRow: 32, charted: true },
      ],
    } as unknown as WorldView
    const crossing = [{ position: { sectorId: 'east', x: 0, y: 4 }, durationMs: 200 }]
    const motion = new WorldMotion(seamView)
    motion.plan(crossing, seamView.sectors, 0)
    const start = motion.sample(0).point
    expect(motion.sample(100).point.x - start.x).toBeCloseTo(0.5)
    motion.reconcile({ ...seamView, route: crossing }, 100)
    expect(motion.sample(110).point.x - start.x).toBeGreaterThanOrEqual(0.5)
    motion.reconcile({ ...seamView, position: crossing[0]!.position }, 200)
    expect(motion.sample(200).point.x - start.x).toBeCloseTo(1)
    expect(motion.sample(200).position).toEqual(crossing[0]!.position)
  })
  it('keeps westbound and repeated seam crossings continuous while preserving canonical positions', () => {
    const seamView = {
      ...view,
      position: { sectorId: 'east', x: 0, y: 4 },
      sectors: [
        { id: 'west', atlasColumn: 127, atlasRow: 32, charted: true },
        { id: 'east', atlasColumn: 0, atlasRow: 32, charted: true },
      ],
    } as unknown as WorldView
    const west = { sectorId: 'west', x: 12, y: 4 }
    const motion = new WorldMotion(seamView)
    motion.plan([{ position: west, durationMs: 200 }], seamView.sectors, 0)
    expect(motion.sample(100).point.x).toBeCloseTo(0)
    motion.reconcile({ ...seamView, position: west }, 200)
    expect(motion.sample(200).point.x).toBeCloseTo(-0.5)
    motion.plan([{ position: seamView.position, durationMs: 200 }], seamView.sectors, 200)
    expect(motion.sample(300).point.x).toBeCloseTo(0)
    motion.reconcile(seamView, 400)
    expect(motion.sample(400).point.x).toBeCloseTo(0.5)
  })
  it.each(
    [200, 400].flatMap((durationMs) =>
      ['straight', 'turn', 'seam'].map((path) => ({ durationMs, path })),
    ),
  )(
    'keeps confirmed $durationMs ms $path steps on phase through repeated near-boundary receipts',
    ({ durationMs, path }) => {
      const initial =
        path === 'seam'
          ? ({
              ...view,
              position: { sectorId: 'west', x: 12, y: 4 },
              sectors: [
                { id: 'west', atlasColumn: 127, atlasRow: 32, charted: true },
                { id: 'east', atlasColumn: 0, atlasRow: 32, charted: true },
              ],
            } as unknown as WorldView)
          : view
      const destinations =
        path === 'seam'
          ? [0, 1, 2].map((x) => ({ sectorId: 'east', x, y: 4 }))
          : (path === 'turn'
              ? [
                  [2, 4],
                  [2, 3],
                  [3, 3],
                ]
              : [
                  [2, 4],
                  [3, 4],
                  [4, 4],
                ]
            ).map(([x, y]) => ({ ...position, x: x!, y: y! }))
      const confirmed = {
        ...initial,
        route: destinations.map((position) => ({ position, durationMs })),
      }
      const reference = new WorldMotion(initial)
      const motion = new WorldMotion(initial)
      reference.reconcile(confirmed, 0)
      motion.reconcile(confirmed, 0)
      const receipts = new Set([
        durationMs - 10,
        durationMs,
        2 * durationMs - 10,
        2 * durationMs,
        3 * durationMs - 10,
      ])
      for (let now = 0; now <= 3 * durationMs; now++) {
        if (receipts.has(now)) motion.reconcile(confirmed, now)
        for (const axis of ['x', 'y'] as const)
          expect(motion.sample(now).point[axis], `at ${now}ms ${axis}`).toBeCloseTo(
            reference.sample(now).point[axis],
            8,
          )
      }
      expect(motion.sample(3 * durationMs)).toEqual(reference.sample(3 * durationMs))
      motion.reconcile(confirmed, 3 * durationMs)
      expect(motion.sample(3 * durationMs).moving).toBe(false)
    },
  )
  it('bounds an unconfirmed preview and never interpolates into an unloaded sector', () => {
    const motion = new WorldMotion(view)
    motion.plan(
      Array.from({ length: 10 }, (_, i) => ({
        position: { ...position, x: 2 + i },
        durationMs: 200,
      })),
      view.sectors,
      0,
    )
    expect(motion.sample(3000).point.x).toBeLessThanOrEqual(4.5)
    motion.reconcile(
      {
        ...view,
        route: [...route, { position: { sectorId: 'unloaded', x: 0, y: 4 }, durationMs: 200 }],
      },
      0,
    )
    expect(motion.sample(5000).point.x).toBe(4.5)
  })
  it('starts interpolation immediately and never rewinds on a late confirmation', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    expect(motion.sample(40).point.x).toBeGreaterThan(1.5)
    const before = motion.sample(250).point.x
    motion.reconcile({ ...view, route }, 250)
    expect(motion.sample(270).point.x).toBeGreaterThanOrEqual(before)
  })
  it('replans from the interpolated position instead of the old tile', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(250).point
    motion.plan([{ position: { ...position, x: 3, y: 5 }, durationMs: 200 }], view.sectors, 250)
    expect(motion.sample(250).point).toEqual(before)
    expect(motion.sample(300).point.y).toBeGreaterThan(before.y)
  })
})

it('approval-only blocking authority overrides a newer visual plan', () => {
  const motion = new WorldMotion(view, 0)
  motion.plan(route, sectors, 0)
  motion.approveReceipt({ ...view, movementBlocked: 'Stop Passive Training to travel.' }, 100)
  expect(motion.sample(300).moving).toBe(false)
  expect(motion.sample(300).position).toEqual(view.position)
})
it('holds an attack preview at its exact visual point while retaining the approved arrival clock', () => {
  const approved = {
    ...view,
    serverNow: 1000,
    nextStepAt: 1200,
    route,
    movementBlocked: null,
    battleSessionId: null,
  }
  const motion = new WorldMotion(approved, 0),
    point = motion.sample(100).point
  motion.hold(100)
  expect(motion.sample(300)).toMatchObject({ point, moving: false })
  expect(motion.approvedPosition(200)).toEqual(route[0]!.position)
})
