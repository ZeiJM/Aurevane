import type { WorldWeather } from '@/world/environment'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { hashString } from '@/world/terrain-gen'
import type { WorldSectorView } from '@/world/types'

export interface HeatEmitter {
  x: number
  y: number
  seed: number
}
export function terrainHeatEmitters(sectors: readonly WorldSectorView[]): HeatEmitter[] {
  const emitters: HeatEmitter[] = []
  for (const sector of sectors) {
    const ox = (sector.atlasColumn ?? 0) * GRID_WIDTH,
      oy = (sector.atlasRow ?? 0) * GRID_HEIGHT
    for (const cell of sector.cells)
      if (cell.terrain === 'l')
        emitters.push({
          x: ox + cell.x + 0.5,
          y: oy + cell.y + 0.5,
          seed: hashString(`${sector.id}:${cell.x}:${cell.y}:heat`),
        })
    for (const landmark of sector.landmarks)
      if (landmark.kind === 'camp')
        emitters.push({
          x: ox + landmark.x + 0.5,
          y: oy + landmark.y + 0.5,
          seed: hashString(`${sector.id}:${landmark.id}:heat`),
        })
  }
  return emitters
}

type Precipitation = 'rain' | 'snow'
const wrap = (value: number, range: number) => ((value % range) + range) % range

/** Frostmere's cold precipitation is snow; the server's shared weather stays authoritative. */
export function precipitationKind(weather: WorldWeather, regionId: string): Precipitation | null {
  return weather === 'rain' || weather === 'storm'
    ? regionId === 'frostmere'
      ? 'snow'
      : 'rain'
    : null
}
export function precipitationParticle(
  kind: Precipitation,
  index: number,
  width: number,
  height: number,
  now: number,
) {
  const depth = index % 3,
    speed = kind === 'snow' ? 0.035 + depth * 0.017 : 0.34 + depth * 0.11,
    y = wrap(index * 113.71 + now * speed, height + 48) - 24,
    drift =
      kind === 'snow'
        ? now * (0.009 + depth * 0.004) + Math.sin(now / (1900 + index * 23) + index * 1.7) * 18
        : -now * 0.045,
    x = wrap(index * 193.31 + drift, width + 80) - 40
  return { x, y, radius: 0.9 + depth * 0.6, length: 7 + depth * 4, alpha: 0.16 + depth * 0.1 }
}
/** Fixed particle count, no textures/filters or retained per-frame objects. */
export function paintPrecipitation(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  weather: WorldWeather,
  regionId: string,
) {
  const kind = precipitationKind(weather, regionId)
  if (!kind || width <= 0 || height <= 0) return 0
  const count = kind === 'snow' ? 64 : weather === 'storm' ? 128 : 88
  context.save()
  context.lineCap = 'round'
  context.lineWidth = 1
  for (let index = 0; index < count; index++) {
    const particle = precipitationParticle(kind, index, width, height, now)
    context.globalAlpha = particle.alpha
    context.beginPath()
    if (kind === 'snow') {
      context.fillStyle = '#edf4ed'
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
      context.fill()
    } else {
      context.strokeStyle = '#c6e2e6'
      context.moveTo(particle.x, particle.y)
      context.lineTo(particle.x - particle.length * 0.1, particle.y + particle.length)
      context.stroke()
    }
  }
  context.restore()
  return count
}

/** Desert dust and visible heat sources have distinct bounded motion. */
export function paintTerrainAtmosphere(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  regionId: string,
  emitters: readonly HeatEmitter[],
  project: (point: { x: number; y: number }) => { x: number; y: number },
) {
  let count = 0
  context.save()
  if (regionId === 'glasswind-desert') {
    context.strokeStyle = '#d7bc87'
    context.lineWidth = 0.9
    for (let i = 0; i < 24; i++) {
      const phase = (now / (6200 + i * 97) + i * 0.37) % 1,
        x = phase * (width + 120) - 60,
        y = height * (0.22 + (i % 9) * 0.078) + Math.sin(now / 1700 + i) * 7
      context.globalAlpha = Math.sin(phase * Math.PI) * (0.12 + (i % 3) * 0.05)
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + 3 + (i % 5), y - 0.7)
      context.stroke()
      count++
    }
  }
  let sources = 0
  for (const emitter of emitters) {
    const point = project(emitter)
    if (point.x < -30 || point.x > width + 30 || point.y < -30 || point.y > height + 70) continue
    if (sources++ >= 12) break
    for (let i = 0; i < 4; i++) {
      const phase = (now / (2100 + (emitter.seed % 1300)) + i / 4 + (emitter.seed % 997) / 997) % 1,
        x = point.x + Math.sin(phase * 5 + emitter.seed + i) * (3 + phase * 9),
        y = point.y - phase * (22 + (emitter.seed % 31))
      context.globalAlpha = (1 - phase) * 0.7
      context.fillStyle = i % 2 ? '#ffa85b' : '#ffc985'
      context.beginPath()
      context.ellipse(x, y, 1 + (i % 2) * 0.4, 1.5 + (i % 3) * 0.5, phase, 0, Math.PI * 2)
      context.fill()
      count++
    }
  }
  context.restore()
  return count
}
