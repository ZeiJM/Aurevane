import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { atlasSectors } from './atlas'
import { terrainWalkable } from './terrain'
import { findWorldRoute, isCurrentWorldRoute, isWalkable, newWorldState } from './travel'
import { resolveWorldIntent } from '@/server/world/world-service'
import legacy from './town-topology.legacy.json'

const towns = () => atlasSectors().filter((s) => s.townId)
it('makes town water explicitly walkable while keeping deep wilderness water blocked', () => {
  expect(terrainWalkable('w')).toBe(true)
  expect(terrainWalkable('~')).toBe(false)
  const water = towns().flatMap((s) =>
    s.rows.flatMap((r, y) => [...r].flatMap((t, x) => (t === 'w' ? [{ s, x, y }] : []))),
  )
  expect(water.length).toBeGreaterThan(100)
  for (const { s, x, y } of water) expect(isWalkable(s, { x, y })).toBe(true)
  expect(towns().every((s) => !s.rows.join('').includes('~'))).toBe(true)
})
it('authors different building compositions in all eight complete districts rather than repeating the root stamp', () => {
  const ids = [...new Set(towns().map((s) => s.townId))]
  const rootSignatures = ids.map((id) =>
    JSON.stringify(
      towns()
        .find((s) => s.id === id)
        ?.buildings?.map((b) => [b.x, b.y, b.width, b.height]),
    ),
  )
  expect(new Set(rootSignatures).size).toBe(8)
  for (const id of ids) {
    const districts = towns().filter((s) => s.townId === id)
    expect(districts).toHaveLength(9)
    const compositions = districts.map((s) =>
      JSON.stringify(
        s.buildings
          ?.filter((b) => b.propIndex === undefined)
          .map((b) => [b.x, b.y, b.width, b.height]),
      ),
    )
    expect(new Set(compositions).size, id).toBeGreaterThanOrEqual(7)
    expect(
      districts.flatMap((s) => s.buildings ?? []).some((b) => b.width >= 4 || b.height >= 3),
      id,
    ).toBe(true)
  }
})
it('gives every newly blocked saved position a canonical one-step exit without relocating it', () => {
  const sectors = atlasSectors(),
    byId = new Map(sectors.map((s) => [s.id, s]))
  const trapped: string[] = []
  let changed = 0
  for (const before of legacy) {
    const after = byId.get(before.id)!
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 13; x++) {
        if (!terrainWalkable(before.rows[y]![x]!) || isWalkable(after, { x, y })) continue
        changed++
        const target = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
          .map(([dx, dy]) => ({ sectorId: after.id, x: x + dx!, y: y + dy! }))
          .find((p) => isWalkable(after, p))
        if (!target) {
          trapped.push(`${after.id}:${x}:${y}`)
          continue
        }
        expect(findWorldRoute({ sectorId: after.id, x, y }, target, [after])).toHaveLength(1)
        expect(findWorldRoute(target, { sectorId: after.id, x, y }, [after])).toBeNull()
      }
  }
  expect(changed).toBeGreaterThan(30)
  expect(trapped).toEqual([])
})
it('connects all town landmarks, districts and perimeter gate approaches to their historic square', () => {
  const all = atlasSectors()
  for (const id of [...new Set(towns().map((s) => s.townId!))]) {
    const from = { sectorId: id, x: 6, y: 4 }
    expect(
      isWalkable(
        all.find((s) => s.id === id)!,
        from,
      ),
    ).toBe(true)
    for (const s of towns().filter((s) => s.townId === id)) {
      for (const l of s.landmarks)
        expect(
          findWorldRoute(from, { sectorId: s.id, x: l.x, y: l.y }, all),
          `${id} ${l.name}`,
        ).not.toBeNull()
      expect(s.roads.length, s.id).toBeGreaterThan(0)
      expect(
        findWorldRoute(from, { sectorId: s.id, x: 6, y: 4 }, all),
        `${id} district ${s.id}`,
      ).not.toBeNull()
    }
  }
  const crown = towns().filter((s) => s.townId === 'aureth-crown')
  expect(
    crown.flatMap((s) => s.buildings ?? []).filter((b) => b.artIndex === 9).length,
  ).toBeGreaterThan(10)
  const moat = towns().filter((s) => s.townId === 'umbral-march')
  expect(moat.filter((s) => s.rows.join('').includes('w')).length).toBeGreaterThan(5)
  expect(
    moat.flatMap((s) => s.landmarks).filter((l) => l.kind === 'bridge').length,
  ).toBeGreaterThanOrEqual(2)
})
it('cancels a saved route into new architecture before settlement and preserves the saved player origin', () => {
  const sectors = atlasSectors(),
    s = sectors.find((s) => s.id === 'aureth-crown')!
  const blocked = s.rows
    .flatMap((row, y) => [...row].flatMap((t, x) => (t === 'b' ? [{ x, y }] : [])))
    .find((p) => isWalkable(s, { x: p.x, y: p.y + 1 }))!
  expect(blocked).toBeDefined()
  const from = { sectorId: s.id, x: blocked.x, y: blocked.y + 1 },
    to = { sectorId: s.id, ...blocked }
  const route = [{ position: to, durationMs: 200 }]
  expect(isCurrentWorldRoute(from, route, sectors, () => true)).toBe(false)
  const next = resolveWorldIntent(
    { ...newWorldState(), position: from, route, nextStepAt: 1000 },
    { kind: 'tick' },
    1200,
  )
  expect(next.position).toEqual(from)
  expect(next.route).toEqual([])
})
it('keeps every Crown perimeter wall solid and each cardinal gate open', () => {
  const districts = towns().filter((s) => s.townId === 'aureth-crown')
  const root = districts.find((s) => s.id === 'aureth-crown')!
  const at = (x: number, y: number) => {
    const s = districts.find(
      (s) =>
        s.atlasColumn === root.atlasColumn! - 1 + Math.floor(x / 13) &&
        s.atlasRow === root.atlasRow! - 1 + Math.floor(y / 9),
    )!
    return s.rows[y % 9]![x % 13]!
  }
  for (let y = 2; y <= 24; y++)
    for (const x of [2, 36]) expect(terrainWalkable(at(x, y))).toBe(Math.abs(y - 13) <= 1)
  for (let x = 2; x <= 36; x++)
    for (const y of [2, 24]) expect(terrainWalkable(at(x, y))).toBe(Math.abs(x - 19) <= 1)
})
it('keeps canonical building footprints blocked rather than covering walkable holes', () => {
  const holes: string[] = []
  for (const s of towns())
    for (const b of s.buildings ?? [])
      for (let y = b.y; y < b.y + b.height; y++)
        for (let x = b.x; x < b.x + b.width; x++) {
          if (terrainWalkable(s.rows[y]![x]!)) holes.push(`${s.id}:${x}:${y}`)
        }
  expect(holes).toEqual([])
})
