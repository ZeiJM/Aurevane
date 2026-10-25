/** Installed only by the native timing investigation. Serialized by Playwright. */
export function installWorldRenderTiming(element: HTMLElement | SVGElement) {
  const canvas = element as HTMLCanvasElement
  const identity = document.querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
  const context = identity.getContext('2d')!
  const original = context.fillText.bind(context)
  const records: Record<string, number>[] = []
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
    'prepareMs',
    'terrainMs',
    'sceneryMs',
    'atmosphereMs',
    'identityMs',
  ]
  let queued = false
  canvas.dataset.renderDiagnostics = 'timing'
  context.fillText = (text, x, y, maxWidth) => {
    if (maxWidth === undefined) original(text, x, y)
    else original(text, x, y, maxWidth)
    if (queued) return
    queued = true
    // Read after the complete RAF callback so identity cost includes the actual
    // draw, without moving or replacing the existing fillText sample timestamp.
    queueMicrotask(() => {
      queued = false
      try {
        const raw = JSON.parse(canvas.dataset.renderTiming ?? 'null')
        if (
          !raw ||
          !fields.every((key) => typeof raw[key] === 'number' && Number.isFinite(raw[key]))
        )
          return
        if (records.at(-1)?.frameAt === raw.frameAt) return
        records.push(Object.fromEntries(fields.map((key) => [key, raw[key] as number])))
        if (records.length > 1500) records.shift()
        canvas.dataset.testRenderTimings = JSON.stringify(records)
      } catch {
        // Missing or incomplete diagnostics must never interrupt real painting.
      }
    })
  }
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
  const samples: Record<string, number>[] = []
  context.fillText = (text, x, y, maxWidth) => {
    if (text === options.name) {
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
    if (maxWidth === undefined) original(text, x, y)
    else original(text, x, y, maxWidth)
  }
}
