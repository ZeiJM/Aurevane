import type { Chimney } from './map-regional-art'

/** Reuse a tiny feathered puff rather than running canvas filters over each chimney. */
export function createChimneyPuff() {
  const layer = document.createElement('canvas')
  layer.width = layer.height = 64
  const context = layer.getContext('2d')!
  for (const [x, y, radius] of [
    [28, 34, 24],
    [37, 25, 19],
    [39, 39, 17],
  ] as const) {
    const feather = context.createRadialGradient(x, y, 0, x, y, radius)
    feather.addColorStop(0, 'rgba(212,216,204,.66)')
    feather.addColorStop(0.52, 'rgba(201,207,196,.28)')
    feather.addColorStop(1, 'rgba(178,188,185,0)')
    context.fillStyle = feather
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  return layer
}

/** Paint in the same depth slot and coordinate space as the actual roof. */
export function paintChimneySmoke(
  context: CanvasRenderingContext2D,
  puff: HTMLCanvasElement,
  flue: Chimney,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  now: number,
  windSpeed: number,
) {
  const originX = x + (flue[0] / 384) * width,
    originY = y + (flue[1] / 336) * height
  const gust = 0.85 + Math.sin(now / 1400 + (seed % 31)) * 0.15
  const lean = windSpeed * 6.8 * flue[2] * gust
  const clock = now / (3300 + (seed % 900)) + (seed % 997) / 997
  context.save()
  for (let i = 0; i < 5; i++) {
    const age = (clock + i / 5) % 1
    const spread = width * (0.045 + age * 0.16)
    const drift = width * (lean * age ** 1.45 + Math.sin(age * 8 + (seed % 19)) * age * 0.027)
    context.globalAlpha = Math.sin(age * Math.PI) * (0.51 - age * 0.2)
    context.drawImage(
      puff,
      originX + drift - spread / 2,
      originY - age * width * 0.29 - spread * 0.43,
      spread,
      spread * 0.86,
    )
  }
  context.restore()
}
