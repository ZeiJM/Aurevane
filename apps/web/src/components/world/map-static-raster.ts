export type StaticMapRaster = HTMLCanvasElement | ImageBitmap

export function snapshotStaticRaster(source: HTMLCanvasElement): StaticMapRaster {
  if (typeof OffscreenCanvas === 'undefined') return source
  let scratch: OffscreenCanvas | undefined
  try {
    scratch = new OffscreenCanvas(source.width, source.height)
    const context = scratch.getContext('2d')
    if (!context) return source
    context.drawImage(source, 0, 0)
    const image = scratch.transferToImageBitmap()
    source.width = source.height = 0
    return image
  } catch {
    return source
  } finally {
    if (scratch) scratch.width = scratch.height = 0
  }
}

export function releaseStaticRaster(raster: StaticMapRaster) {
  if ('close' in raster) raster.close()
  else raster.width = raster.height = 0
}
