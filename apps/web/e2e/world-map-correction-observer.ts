export interface CorrectionObservation {
  assets: Record<string, { draws: number; width: number; height: number }>
  frames: Record<string, number>[]
  ghostPaints: number
  selfGhostPaints: number
  selfPaints: number
  shallowRipplePaints: number
  webglContexts: number
  globePaintingUploads: number
  globeDraws: number
  fallbackPaints: number
}
/** Serialized before mount: observes native Canvas calls without replacing rendering or geometry. */
export function installCorrectionObserver() {
  const evidence: CorrectionObservation = {
    assets: {},
    frames: [],
    ghostPaints: 0,
    selfGhostPaints: 0,
    selfPaints: 0,
    shallowRipplePaints: 0,
    webglContexts: 0,
    globePaintingUploads: 0,
    globeDraws: 0,
    fallbackPaints: 0,
  }
  ;(window as unknown as { __mapCorrection: CorrectionObservation }).__mapCorrection = evidence
  const wrapped = new WeakSet<object>()
  const original = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    kind: string,
    ...args: unknown[]
  ) {
    const context = Reflect.apply(original, this, [kind, ...args]) as RenderingContext | null
    if (kind === 'webgl' && context && !wrapped.has(context)) {
      wrapped.add(context)
      this.dataset.testCorrectionWebgl = 'true'
      evidence.webglContexts++
      const gl = context as WebGLRenderingContext
      gl.texImage2D = new Proxy(gl.texImage2D, {
        apply(target, receiver, values) {
          if (
            values.some(
              (value) =>
                value instanceof HTMLImageElement &&
                value.src.endsWith('globe-materials-v02.webp') &&
                value.naturalWidth > 0,
            )
          )
            evidence.globePaintingUploads++
          return Reflect.apply(target, receiver, values)
        },
      })
      gl.drawArrays = new Proxy(gl.drawArrays, {
        apply(target, receiver, values) {
          evidence.globeDraws++
          return Reflect.apply(target, receiver, values)
        },
      })
    }
    if (kind !== '2d' || !context || wrapped.has(context)) return context
    wrapped.add(context)
    const paint = context as CanvasRenderingContext2D
    const canvas = paint.canvas
    if (canvas.hasAttribute('data-world-stage')) canvas.dataset.renderDiagnostics = 'timing'
    const identity = canvas.hasAttribute('data-world-identity')
    paint.putImageData = new Proxy(paint.putImageData, {
      apply(target, receiver, values) {
        if (canvas.hasAttribute('data-globe-fallback')) evidence.fallbackPaints++
        return Reflect.apply(target, receiver, values)
      },
    })
    paint.drawImage = new Proxy(paint.drawImage, {
      apply(target, receiver, values) {
        const image = values[0] as HTMLImageElement
        const source = typeof image?.src === 'string' ? image.src : ''
        if (source.includes('/media/art/world/runtime/') && image.naturalWidth > 0) {
          const name = source.split('/').at(-1)!
          const previous = evidence.assets[name]
          evidence.assets[name] = {
            draws: (previous?.draws ?? 0) + 1,
            width: image.naturalWidth,
            height: image.naturalHeight,
          }
        }
        if (identity && paint.filter.includes('grayscale')) evidence.ghostPaints++
        return Reflect.apply(target, receiver, values)
      },
    })
    paint.stroke = new Proxy(paint.stroke, {
      apply(target, receiver, values) {
        if (identity && paint.strokeStyle === '#ead399') evidence.selfPaints++
        if (
          identity &&
          paint.strokeStyle === '#ead399' &&
          (paint.filter.includes('grayscale') || paint.fillStyle === '#a6b1b0')
        )
          evidence.selfGhostPaints++
        if (canvas.hasAttribute('data-world-stage') && paint.strokeStyle === '#d5ece2')
          evidence.shallowRipplePaints++
        return Reflect.apply(target, receiver, values)
      },
    })
    paint.fill = new Proxy(paint.fill, {
      apply(target, receiver, values) {
        if (identity && paint.fillStyle === '#a6b1b0') evidence.ghostPaints++
        return Reflect.apply(target, receiver, values)
      },
    })
    return context
  } as typeof original
  let lastRaw = ''
  const sample = () => {
    const raw = document.querySelector<HTMLCanvasElement>('canvas[data-world-stage]')?.dataset
      .renderTiming
    if (raw && raw !== lastRaw) {
      lastRaw = raw
      const timing = JSON.parse(raw) as Record<string, number>
      const fields = [
        'frameAt',
        'startedAt',
        'completedAt',
        'groundBuilds',
        'groundBuildMs',
        'groundResamples',
        'groundResampleMs',
        'terrainMs',
        'sceneryMs',
        'prepareMs',
        'identityMs',
      ]
      if (fields.every((key) => Number.isFinite(timing[key]))) {
        const stage = document.querySelector<HTMLCanvasElement>('canvas[data-world-stage]')!
        const previous = evidence.frames.at(-1)
        const travellerX = Number(stage.dataset.travellerX),
          travellerY = Number(stage.dataset.travellerY)
        evidence.frames.push({
          ...Object.fromEntries(fields.map((key) => [key, timing[key]!])),
          travellerX,
          travellerY,
          tile: Number(stage.dataset.tileSize),
          presentedMoving:
            previous &&
            Math.hypot(travellerX - previous.travellerX!, travellerY - previous.travellerY!) > 1e-6
              ? 1
              : 0,
        })
        // Preserve cold construction even on a slow asset load; retain recent moving frames.
        if (evidence.frames.length > 600) evidence.frames.splice(60, 1)
      }
    }
    requestAnimationFrame(sample)
  }
  requestAnimationFrame(sample)
}
