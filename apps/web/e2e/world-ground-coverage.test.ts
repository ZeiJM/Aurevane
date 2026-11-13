import { expect, test } from 'vitest'

import { installWorldGroundCoverage, missingPublicGround } from './world-ground-coverage'
import type { WorldSectorView } from '../src/world/types'

test('detects withdrawn supplied ground from the actual isometric body and excludes unknown/private cells', () => {
  const sector = {
    id: 'public',
    charted: true,
    atlasColumn: 0,
    atlasRow: 0,
    cells: Array.from({ length: 117 }, (_, i) => ({ x: i % 13, y: Math.floor(i / 13) })),
  } as WorldSectorView
  const frame = {
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

test('enables producer-owned completed-frame collection without an external observer', () => {
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
  expect(canvas.dataset.renderDiagnostics).toBe('coverage')
  expect(canvas.dataset.testGroundCoverage).toBe('[]')
  expect(canvas.dataset.testGroundCoverageStopped).toBeUndefined()
})
