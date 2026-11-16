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
    'wildlifePartBuilds',
    'wildlifePartPixels',
    'weatherVeilBuilds',
    'weatherVeilPixels',
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
    } catch {
      // Missing or incomplete diagnostics must never interrupt real painting.
    }
  })
  canvas.__worldRenderTimingObserver.observe(canvas, {
    attributes: true,
    attributeFilter: ['data-render-timing'],
  })
}

/** Read captured timing without serializing an ever-growing DOM attribute after every frame. */
export function readWorldRenderTiming(element: HTMLElement | SVGElement) {
  const canvas = element as HTMLCanvasElement & {
    __worldRenderTimingRecords?: Record<string, number>[]
  }
  return (canvas.__worldRenderTimingRecords ?? []).map((record) => ({ ...record }))
}

/** Serialized by Playwright; all samples use this frame's camera and projection. */
export interface WorldPeerDrawSample {
  at: number
  frameAt: number
  paintingMs: number
  tileSize: number
  identityRatio: number
  screenX: number
  screenY: number
  x: number
  y: number
}

export function installWorldPeerDrawCapture(
  element: HTMLElement | SVGElement,
  options: {
    name: string
    sampleKey: 'testRemoteDraws' | 'testMovingObserverDraws'
    limit: number
  },
) {
  const canvas = element as HTMLCanvasElement & {
    __worldPeerDrawCapture?: {
      options: typeof options
      samples: WorldPeerDrawSample[]
      paintedLabel?: { x: number; y: number }
      observer: MutationObserver
    }
  }
  const active = canvas.__worldPeerDrawCapture
  if (active) {
    delete canvas.dataset[active.options.sampleKey]
    active.options = options
    active.samples = []
    active.paintedLabel = undefined
    delete canvas.dataset[options.sampleKey]
    return
  }
  const identity = document.querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
  const context = identity.getContext('2d')!
  const original = context.fillText.bind(context)
  const originalClear = context.clearRect.bind(context)
  const state = {
    options,
    samples: [] as WorldPeerDrawSample[],
    paintedLabel: undefined as { x: number; y: number } | undefined,
    observer: null as unknown as MutationObserver,
  }
  canvas.__worldPeerDrawCapture = state
  const sample = () => {
    if (state.paintedLabel && state.samples.at(-1)?.frameAt !== Number(canvas.dataset.frameNow)) {
      const { x, y } = state.paintedLabel
      const tile = Number(canvas.dataset.tileSize)
      const east = (x - identity.clientWidth / 2) / (tile * 0.85)
      const north = (y - identity.clientHeight / 2) / (tile * 0.44)
      // The nameplate offset is fixed; it cancels between same-projection draws.
      state.samples.push({
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
      if (state.samples.length > state.options.limit) state.samples.shift()
    }
  }
  context.fillText = (text, x, y, maxWidth) => {
    if (text === state.options.name) {
      state.paintedLabel = { x, y }
      sample()
    }
    if (maxWidth === undefined) original(text, x, y)
    else original(text, x, y, maxWidth)
  }
  context.clearRect = (x, y, width, height) => {
    state.paintedLabel = undefined
    originalClear(x, y, width, height)
  }
  // A retained screen-space label still changes world position with its camera.
  // Observe completed renderer frames, reusing only coordinates actually painted;
  // clearing the identity surface invalidates a label that is no longer visible.
  state.observer = new MutationObserver(sample)
  state.observer.observe(canvas, {
    attributes: true,
    attributeFilter: ['data-frame-now'],
  })
}

/** Read exact native draw samples without adding observer work to every animation frame. */
export function readWorldPeerDrawCapture(element: HTMLElement | SVGElement) {
  const canvas = element as HTMLCanvasElement & {
    __worldPeerDrawCapture?: { samples: WorldPeerDrawSample[] }
  }
  return (canvas.__worldPeerDrawCapture?.samples ?? []).map((sample) => ({ ...sample }))
}

export async function hashWorldBackingPixels(element: HTMLElement | SVGElement) {
  const bitmap = element as HTMLCanvasElement
  // Never call getImageData on the live renderer: repeated reads can migrate
  // its backing store between GPU/CPU raster paths and change rounding.
  const copy = document.createElement('canvas')
  copy.width = bitmap.width
  copy.height = bitmap.height
  const context = copy.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!context) throw new Error('Backing pixel capture has no 2D context')
  context.globalCompositeOperation = 'copy'
  context.drawImage(bitmap, 0, 0)
  const pixels = context.getImageData(0, 0, copy.width, copy.height).data
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(pixels))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
