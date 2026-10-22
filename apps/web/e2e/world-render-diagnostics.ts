/** Installed only by the native timing investigation. Serialized by Playwright. */
export function installWorldRenderTiming(element: HTMLElement | SVGElement) {
  const canvas = element as HTMLCanvasElement
  const identity = document.querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
  const context = identity.getContext('2d')!
  const original = context.fillText.bind(context)
  const records: Record<string, number>[] = []
  const fields = [
    'frameAt',
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
