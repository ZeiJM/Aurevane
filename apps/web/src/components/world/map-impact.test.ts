import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { atlasSectors } from '@/world/atlas'
import { newWorldState } from '@/world/travel'
import { projectWorld } from '@/server/world/world-service'
import type { WorldSectorView, WorldState } from '@/world/types'
import { impactSite, paintImpactGround } from './map-impact'

const fixtures = [
  ['atlas:45:9', 9.5, 6.5, 0],
  ['atlas:65:21', 2.5, 2.5, 1],
  ['uncharted-pale', 3.5, 3.5, 2],
] as const
function projected(id: string, discoveries = Array.from({ length: 117 }, (_, i) => i)) {
  const state: WorldState = {
    ...newWorldState(),
    position: { sectorId: id, x: 6, y: 4 },
    warpedPhase: 0,
    discoveries: { [id]: discoveries },
  }
  return projectWorld(state, [], 1000).sectors.find((s) => s.id === id)!
}
const image = { complete: true, naturalWidth: 1536, naturalHeight: 512 } as HTMLImageElement
const context = () =>
  new Proxy(
    { drawImage: vi.fn(), rect: vi.fn(), clip: vi.fn() },
    {
      get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()),
    },
  ) as unknown as CanvasRenderingContext2D

it('actually paints all three fixed variants on canonical projected natural footprints', () => {
  for (const [id, x, y, index] of fixtures) {
    if (id.startsWith('atlas:')) expect(atlasSectors().some((s) => s.id === id)).toBe(true)
    const source = projected(id),
      ctx = context(),
      before = JSON.stringify(source)
    expect(impactSite(source)).toEqual({ x, y, index, size: 3 })
    expect(paintImpactGround(ctx, source, 64, image)).toBe(true)
    expect(ctx.drawImage).toHaveBeenCalledWith(
      image,
      index * 512,
      0,
      512,
      512,
      (x - 1.5) * 64,
      (y - 1.5) * 64,
      192,
      192,
    )
    expect(ctx.rect).toHaveBeenCalledTimes(9)
    expect(ctx.clip).toHaveBeenCalledOnce()
    expect(JSON.stringify(source)).toBe(before)
  }
})

it('waits for the complete fixed private footprint without relocation as cells are revealed', () => {
  const source = projected('uncharted-pale'),
    site = impactSite(source)!
  const footprint = source.cells.filter((c) => c.x >= 2 && c.x < 5 && c.y >= 2 && c.y < 5)
  const partial = projected(
    source.id,
    footprint.slice(0, 8).map((c) => c.y * 13 + c.x),
  )
  expect(impactSite(partial)).toBeUndefined()
  expect(paintImpactGround(context(), partial, 64, image)).toBe(false)
  const revealed = projected(
    source.id,
    footprint.map((c) => c.y * 13 + c.x),
  )
  expect(impactSite(revealed)).toEqual(site)
  expect(paintImpactGround(context(), revealed, 64, image)).toBe(true)
  expect(impactSite({ ...source, cells: [...source.cells].reverse() })).toEqual(site)
})

it('never stamps unknown, liquid, paved, safe or occupied ground or unrelated sectors', () => {
  const source = projected('atlas:65:21')
  for (const terrain of ['~', 'l', '=', 's', '?']) {
    const changed = {
      ...source,
      cells: source.cells.map((c) => (c.x === 2 && c.y === 2 ? { ...c, terrain } : c)),
    }
    expect(impactSite(changed)).toBeUndefined()
    expect(paintImpactGround(context(), changed, 64, image)).toBe(false)
  }
  const exclusions: WorldSectorView[] = [
    { ...source, cells: source.cells.filter((c) => c.x !== 2 || c.y !== 2) },
    {
      ...source,
      cells: source.cells.map((c) => (c.x === 2 && c.y === 2 ? { ...c, safe: true } : c)),
    },
    { ...source, townId: 'town' },
    { ...source, id: 'another-sector' },
    { ...source, charted: false },
    { ...source, buildings: [{ id: 'building', x: 2, y: 2, width: 1, height: 1, artIndex: 0 }] },
    { ...source, landmarks: [{ id: 'focal', name: 'Focal', kind: 'ruin', x: 2, y: 2 }] },
    { ...source, warpedScenery: { x: 2, y: 2, sheet: 'void-relics', index: 0 } },
  ]
  for (const changed of exclusions) expect(impactSite(changed)).toBeUndefined()
  const ctx = context()
  expect(paintImpactGround(ctx, source, 64)).toBe(false)
  expect(
    paintImpactGround(ctx, source, 64, { ...image, complete: false } as HTMLImageElement),
  ).toBe(false)
  expect(ctx.drawImage).not.toHaveBeenCalled()
})
