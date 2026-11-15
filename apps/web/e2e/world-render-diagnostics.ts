/** Start before applying CPU slowdown; resolve on the first completed live count. */
export function startWorldFrameCounting(element: HTMLElement | SVGElement): Promise<number> {
  const canvas = element as HTMLCanvasElement
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      observer.disconnect()
      const count = Number(canvas.dataset.renderFrames)
      if (!Number.isSafeInteger(count) || count < 1)
        reject(new Error('Invalid completed frame count'))
      else resolve(count)
    })
    observer.observe(canvas, { attributes: true, attributeFilter: ['data-render-frames'] })
    canvas.dataset.renderDiagnostics = 'frames'
  })
}

/** Installed only by the native timing investigation. Serialized by Playwright. */
export function installWorldRenderTiming(element: HTMLElement | SVGElement) {
  const canvas = element as HTMLCanvasElement & {
    __worldRenderTimingObserver?: MutationObserver
    __worldRenderTimingRecords?: Record<string, number>[]
  }
  const fields = [
    'frameAt',
    'rafAt',
    'startedAt',
    'callbackDelayMs',
    'completedAt',
    'updates',
    'updateMs',
    'peerUpdateMs',
    'lastPeerUpdateAt',
    'terrainIndexes',
    'terrainIndexMs',
    'groundBuilds',
    'groundBuildMs',
    'groundResamples',
    'groundResampleMs',
    'biomeRasterBuilds',
    'biomeRasters',
    'biomeRasterPixels',
    'prepareMs',
    'terrainMs',
    'sceneryMs',
    'atmosphereMs',
    'identityMs',
  ]
  canvas.__worldRenderTimingRecords = []
  delete canvas.dataset.testRenderTimings
  canvas.dataset.renderDiagnostics = 'timing'
  if (canvas.__worldRenderTimingObserver) return
  // The renderer publishes timing after completing the frame, including frames
  // that retain their identity surface and therefore never call fillText.
  canvas.__worldRenderTimingObserver = new MutationObserver(() => {
    try {
      const raw = JSON.parse(canvas.dataset.renderTiming ?? 'null')
      if (!raw || !fields.every((key) => typeof raw[key] === 'number' && Number.isFinite(raw[key])))
        return
      const records = canvas.__worldRenderTimingRecords ?? []
      if (records.at(-1)?.frameAt === raw.frameAt) return
      records.push(Object.fromEntries(fields.map((key) => [key, raw[key] as number])))
      if (records.length > 1500) records.shift()
      canvas.dataset.testRenderTimings = JSON.stringify(records)
    } catch {
      // Missing or incomplete diagnostics must never interrupt real painting.
    }
  })
  canvas.__worldRenderTimingObserver.observe(canvas, {
    attributes: true,
    attributeFilter: ['data-render-timing'],
  })
}

/** Serialized by Playwright; all samples use this frame's camera and projection. */
export function installWorldPeerDrawCapture(
  element: HTMLElement | SVGElement,
  options: {
    name: string
    sampleKey: 'testRemoteDraws' | 'testMovingObserverDraws'
    limit: number
  },
) {
  const canvas = element as HTMLCanvasElement
  const identity = document.querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
  const context = identity.getContext('2d')!
  const original = context.fillText.bind(context)
  const originalClear = context.clearRect.bind(context)
  const samples: Record<string, number>[] = []
  let paintedLabel: { x: number; y: number } | undefined
  const sample = () => {
    if (paintedLabel && samples.at(-1)?.frameAt !== Number(canvas.dataset.frameNow)) {
      const { x, y } = paintedLabel
      const tile = Number(canvas.dataset.tileSize)
      const east = (x - identity.clientWidth / 2) / (tile * 0.85)
      const north = (y - identity.clientHeight / 2) / (tile * 0.44)
      // The nameplate offset is fixed; it cancels between same-projection draws.
      samples.push({
        at: performance.now(),
        frameAt: Number(canvas.dataset.frameNow),
        paintingMs: performance.now() - Number(canvas.dataset.frameStarted),
        tileSize: tile,
        identityRatio: identity.width / identity.clientWidth,
        screenX: x,
        screenY: y,
        x: Number(canvas.dataset.cameraX) + (east + north) / 2,
        y: Number(canvas.dataset.cameraY) + (north - east) / 2,
      })
      if (samples.length > options.limit) samples.shift()
      canvas.dataset[options.sampleKey] = JSON.stringify(samples)
    }
  }
  context.fillText = (text, x, y, maxWidth) => {
    if (text === options.name) {
      paintedLabel = { x, y }
      sample()
    }
    if (maxWidth === undefined) original(text, x, y)
    else original(text, x, y, maxWidth)
  }
  context.clearRect = (x, y, width, height) => {
    paintedLabel = undefined
    originalClear(x, y, width, height)
  }
  // A retained screen-space label still changes world position with its camera.
  // Observe completed renderer frames, reusing only coordinates actually painted;
  // clearing the identity surface invalidates a label that is no longer visible.
  new MutationObserver(sample).observe(canvas, {
    attributes: true,
    attributeFilter: ['data-frame-now'],
  })
}
