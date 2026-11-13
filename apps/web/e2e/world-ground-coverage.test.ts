import { expect, test, vi } from 'vitest'

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

test('enables producer-owned completed-frame collection without overriding render timing', () => {
  const canvas = {
    clientWidth: 800,
    clientHeight: 600,
    dataset: {
      renderDiagnostics: 'timing',
      cameraX: '20',
      cameraY: '10',
      tileSize: '32',
      frameNow: '100',
      paintedGroundIds: JSON.stringify(['atlas:1:1']),
    } as Record<string, string>,
  }

  installWorldGroundCoverage(canvas as unknown as HTMLElement)
  expect(canvas.dataset.renderDiagnostics).toBe('timing')
  expect(canvas.dataset.testGroundCoverage).toBe('[]')
  expect(canvas.dataset.testGroundCoverageStopped).toBeUndefined()
})

test('re-arms coverage after globe travel replaces the World canvas, without resetting live frames', () => {
  let mounted: { dataset: Record<string, string> } | null = null
  let changed: (() => void) | undefined
  const observed: unknown[] = []
  const disconnected: number[] = []
  class Observer {
    constructor(callback: MutationCallback) {
      changed = () => callback([], this as unknown as MutationObserver)
    }
    observe(target: unknown, options: unknown) {
      observed.push([target, options])
    }
    disconnect() {
      disconnected.push(1)
    }
  }
  vi.stubGlobal('MutationObserver', Observer)
  try {
    const host = {
      querySelector: () => mounted,
    }
    const before = {
      parentElement: host,
      dataset: {
        renderDiagnostics: 'timing',
        testGroundCoverageStopped: 'true',
      } as Record<string, string>,
    }
    mounted = before
    installWorldGroundCoverage(before as unknown as HTMLElement)
    expect(before.dataset.renderDiagnostics).toBe('timing')
    expect(before.dataset.testGroundCoverageStopped).toBeUndefined()
    expect(observed).toEqual([[host, { childList: true, subtree: true }]])

    // Globe presentation has no local stage; its return mounts a fresh one.
    mounted = null
    changed?.()
    const after = {
      dataset: {
        renderDiagnostics: 'timing',
        testGroundCoverageStopped: 'true',
      } as Record<string, string>,
    }
    mounted = after
    changed?.()
    expect(after.dataset.renderDiagnostics).toBe('timing')
    expect(after.dataset.testGroundCoverage).toBe('[]')
    expect(after.dataset.testGroundCoverageStopped).toBeUndefined()

    // Unrelated DOM mutations must not erase completed samples on that stage.
    after.dataset.testGroundCoverage = '[{"at":100}]'
    changed?.()
    expect(after.dataset.testGroundCoverage).toBe('[{"at":100}]')
    expect(disconnected).toEqual([])
  } finally {
    vi.unstubAllGlobals()
  }
})
