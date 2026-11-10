import { expect, it, vi } from 'vitest'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import type { WorldSectorView } from '@/world/types'
import { sceneryDressing } from './map-dressing'

vi.mock('server-only', () => ({}))

const town = projectWorld(newWorldState(), [], 1000).sectors[0]!
const cells = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, index) => {
  const x = index % GRID_WIDTH
  const y = Math.floor(index / GRID_WIDTH)
  const terrain = x === 2 ? '~' : y === 4 ? '=' : '.'
  return { x, y, terrain, safe: x > 2, walkable: terrain !== '~' }
})
const market = { id: 'market', name: 'Market', x: 4, y: 3, kind: 'marketplace' } as const
const forge = { id: 'forge', x: 6, y: 3, width: 2, height: 2, artIndex: 2 }
const winter: WorldSectorView = {
  ...town,
  id: 'frostmere',
  townId: 'frostmere',
  regionId: 'frostmere',
  buildings: [forge],
  landmarks: [market],
  cells,
}

it('places Frostmere dressing on dry side ground without covering roads or authored sites', () => {
  const dressing = sceneryDressing(winter)
  expect(dressing.map(({ index }) => index)).toEqual([0, 1])
  expect(sceneryDressing(winter)).toEqual(dressing)
  for (const { x, y } of dressing) {
    expect(cells.find((cell) => cell.x === x && cell.y === y)?.terrain).toBe('.')
    expect(Math.abs(x - market.x) + Math.abs(y - market.y)).toBeGreaterThan(0)
    expect(
      x < forge.x || x >= forge.x + forge.width || y < forge.y || y >= forge.y + forge.height,
    ).toBe(true)
  }
  expect(sceneryDressing({ ...winter, townId: undefined, landmarks: [] })).toEqual([])
})

it('uses different art for woodland markets and coastal fishing gear', () => {
  expect(sceneryDressing({ ...winter, regionId: 'verdant-expanse' })[0]?.index).toBe(2)
  expect(sceneryDressing({ ...winter, regionId: 'hollow-coast' })[0]?.index).toBe(3)
})

it('keeps Void decorations in private scenes and leaves unfeatured districts quiet', () => {
  const landmark = { ...market, kind: 'ruin', warpedArt: 1 } as const
  const sector = { ...winter, charted: false, townId: undefined, landmarks: [landmark] }
  for (const [theme, index] of [
    ['haven', 0],
    ['ashen', 1],
    ['fracture', 2],
    ['amber', 3],
  ] as const)
    expect(
      sceneryDressing({ ...sector, warpedTheme: theme }).map((prop) => [prop.sheet, prop.index]),
    ).toEqual([['void-dressing', index]])
  expect(sceneryDressing({ ...sector, charted: true, warpedTheme: 'haven' })).toEqual([])
  expect(sceneryDressing({ ...sector, warpedTheme: 'haven', landmarks: [] })).toEqual([])
})
