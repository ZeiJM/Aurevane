import { afterEach, expect, test, vi } from 'vitest'

import {
  installWorldGroundCoverage,
  missingPublicGround,
  type GroundCoverageFrame,
} from './world-ground-coverage'
import type { WorldSectorView } from '../src/world/types'

afterEach(() => vi.unstubAllGlobals())

test('detects withdrawn supplied ground from the actual isometric body and excludes unknown/private cells', () => {
  const sector = {
    id: 'public',
    charted: true,
    atlasColumn: 0,
    atlasRow: 0,
    cells: Array.from({ length: 117 }, (_, i) => ({ x: i % 13, y: Math.floor(i / 13) })),
  } as WorldSectorView
  const frame: GroundCoverageFrame = {
    at: 100,
    x: 6.5,
    y: 4.5,
    width: 375,
    height: 667,
    tile: 48,
    painted: [],
  }
  expect(missingPublicGround([sector], frame)).toEqual(['public'])
  expect(missingPublicGround([sector], { ...frame, painted: ['public'] })).toEqual([])
  expect(missingPublicGround([{ ...sector, charted: false }], frame)).toEqual([])
  expect(missingPublicGround([{ ...sector, cells: sector.cells.slice(0, 3) }], frame)).toEqual([])
  expect(missingPublicGround([sector], { ...frame, x: 50, y: 50 })).toEqual([])
})

test('records completed paint frames without requiring an identity-layer repaint', async () => {
  let observer: { notify: () => void } | undefined
  class FakeMutationObserver {
    constructor(private readonly callback: () => void) {
      observer = { notify: callback }
    }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('MutationObserver', FakeMutationObserver)
  const canvas = {
    clientWidth: 800,
    clientHeight: 600,
    dataset: {
      cameraX: '20',
      cameraY: '10',
      tileSize: '32',
      frameNow: '100',
      paintedGroundIds: JSON.stringify(['atlas:1:1']),
    } as Record<string, string>,
  }

  installWorldGroundCoverage(canvas as unknown as HTMLElement)
  expect(observer).toBeDefined()
  observer!.notify()
  await Promise.resolve()

  const frames = JSON.parse(canvas.dataset.testGroundCoverage!) as GroundCoverageFrame[]
  expect(frames).toEqual([
    {
      at: 100,
      x: 20,
      y: 10,
      width: 800,
      height: 600,
      tile: 32,
      painted: ['atlas:1:1'],
    },
  ])
})
