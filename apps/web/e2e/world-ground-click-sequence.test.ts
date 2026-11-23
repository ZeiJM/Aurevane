import { describe, expect, it } from 'vitest'
import type { Page } from '@playwright/test'
import { projectMapPoint } from '../src/components/world/map-projection'
import { GRID_HEIGHT, GRID_WIDTH } from '../src/world/catalog'
import { clickWorldGroundSequence } from './world-ground-click-sequence'

const sector = { id: 'atlas:58:28', atlasColumn: 58, atlasRow: 28 }
const destinations = [7, 5, 10].map((x) => ({ sectorId: sector.id, x, y: 4 }))

function nativePage() {
  let frame = 0
  const frames = [
    { cameraX: 760.5, left: 205.39, top: 132.78, width: 903, height: 752 },
    { cameraX: 761.25, left: 208.5, top: 135.25, width: 901, height: 750 },
    { cameraX: 760.1, left: 201.75, top: 130.5, width: 907, height: 756 },
  ]
  const clicks: { x: number; y: number }[] = []
  const pointerTimes: number[] = []
  const operations: string[] = []
  const canvas = () => {
    const current = frames[frame]!
    return {
      dataset: { cameraX: String(current.cameraX), cameraY: '256.5', tileSize: '64' },
      clientWidth: current.width,
      clientHeight: current.height,
      getBoundingClientRect: () => ({
        ...current,
        width: current.width + 0.15625,
        height: current.height + 0.828125,
      }),
    }
  }
  // Only the native-input surface is provided: any authority read during the
  // burst is an error. Frame/layout changes happen after each native click.
  const page = {
    locator: () => ({
      boundingBox: async () => {
        operations.push('separate bounds')
        const current = frames[frame]!
        return {
          x: current.left,
          y: current.top,
          width: current.width + 0.15625,
          height: current.height + 0.828125,
        }
      },
      evaluate: async (read: (el: unknown, arg: unknown) => unknown, arg: unknown) => {
        operations.push('frame')
        return read(canvas(), arg)
      },
    }),
    context: () => ({
      newCDPSession: async () => ({
        send: async (
          method: string,
          event: { x: number; y: number; timestamp: number; type: string; buttons: number },
        ) => {
          expect(method).toBe('Input.dispatchMouseEvent')
          operations.push(event.type)
          pointerTimes.push(event.timestamp)
          if (event.type === 'mousePressed') {
            expect(event.buttons).toBe(1)
            clicks.push({ x: event.x, y: event.y })
          } else {
            expect(event.buttons).toBe(0)
            frame++
          }
        },
        detach: async () => operations.push('detach'),
      }),
    }),
  } as unknown as Page
  return { page, frames, clicks, pointerTimes, operations }
}

describe('rapid native ground input', () => {
  it('uses each coherent camera/bounds read and the renderer CSS dimensions for the exact requested tile', async () => {
    const { page, frames, clicks, pointerTimes, operations } = nativePage()
    const projections = await clickWorldGroundSequence(page, sector, destinations)
    expect(operations).toEqual([
      'frame',
      'mousePressed',
      'mouseReleased',
      'frame',
      'mousePressed',
      'mouseReleased',
      'frame',
      'mousePressed',
      'mouseReleased',
      'detach',
    ])
    expect(pointerTimes).toEqual(
      projections.flatMap(({ measuredAt }) => {
        const timestamp = (performance.timeOrigin + measuredAt) / 1000
        return [timestamp, timestamp]
      }),
    )
    expect(clicks).toEqual(
      destinations.map((destination, index) => {
        const frame = frames[index]!
        const point = projectMapPoint(
          { x: 58 * GRID_WIDTH + destination.x + 0.5, y: 28 * GRID_HEIGHT + destination.y + 0.5 },
          { x: frame.cameraX, y: 256.5 },
          { x: 0, y: 0 },
          64,
          frame.width,
          frame.height,
        )
        return { x: frame.left + point.x, y: frame.top + point.y }
      }),
    )
  })

  it('rejects an offscreen destination before sending native input', async () => {
    const { page, clicks, operations } = nativePage()
    await expect(
      clickWorldGroundSequence(page, sector, [{ ...destinations[0]!, x: 1000 }]),
    ).rejects.toThrow('must be visible')
    expect(clicks).toEqual([])
    expect(operations).toEqual(['frame', 'detach'])
  })
})
