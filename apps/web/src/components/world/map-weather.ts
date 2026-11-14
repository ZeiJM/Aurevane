import type { WorldWeather } from '@/world/environment'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { hashString } from '@/world/terrain-gen'
import type { WorldSectorView } from '@/world/types'

export interface HeatEmitter {
  x: number
  y: number
  seed: number
  source: 'lava' | 'camp'
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
          source: 'lava',
        })
    for (const landmark of sector.landmarks)
      if (landmark.kind === 'camp')
        emitters.push({
          x: ox + landmark.x + 0.5,
          y: oy + landmark.y + 0.5,
          seed: hashString(`${sector.id}:${landmark.id}:heat`),
          source: 'camp',
        })
  }
  return emitters
}

type Precipitation = 'rain' | 'snow'
const wrap = (value: number, range: number) => ((value % range) + range) % range

const windSpeed: Record<WorldWeather, number> = {
  clear: 0.008,
  fog: 0.004,
  overcast: 0.013,
  rain: 0.023,
  wind: 0.045,
  storm: 0.054,
}

export interface WorldWind {
  /** Signed screen pixels per millisecond at the reference map zoom. */
  speed: number
  /** Integrated distance so a weather update never relocates particles. */
  offset: number
}

/** Regional motion interprets shared weather without modifying its gameplay value. */
export function worldWindTarget(weather: WorldWeather, regionId: string) {
  const region = hashString(regionId)
  return windSpeed[weather] * (region % 2 === 0 ? 1 : -1) * (0.82 + (region % 37) / 100)
}

export function advanceWorldWind(
  previous: WorldWind,
  target: number,
  elapsedMs: number,
): WorldWind {
  const response = 1 - Math.exp(-elapsedMs / 1250)
  const speed = previous.speed + (target - previous.speed) * response
  return { speed, offset: previous.offset + ((previous.speed + speed) / 2) * elapsedMs }
}

/** Frostmere's cold precipitation is snow; the server's shared weather stays authoritative. */
export function precipitationKind(weather: WorldWeather, regionId: string): Precipitation | null {
  return weather === 'rain' || weather === 'storm'
    ? regionId === 'frostmere'
      ? 'snow'
      : 'rain'
    : null
}

/** Falling snow never leaves liquid impact rings. This is a visual blend only. */
export function surfaceRainTarget(weather: WorldWeather, regionId: string) {
  return precipitationKind(weather, regionId) === 'rain' ? (weather === 'storm' ? 1 : 0.55) : 0
}

export function advanceSurfaceRain(previous: number, target: number, elapsedMs: number) {
  return previous + (target - previous) * (1 - Math.exp(-elapsedMs / 780))
}

export function precipitationParticle(
  kind: Precipitation,
  index: number,
  width: number,
  height: number,
  now: number,
  windOffset = now * 0.018,
) {
  const depth = index % 3,
    speed = kind === 'snow' ? 0.035 + depth * 0.017 : 0.34 + depth * 0.11,
    y = wrap(index * 113.71 + now * speed, height + 48) - 24,
    drift =
      kind === 'snow'
        ? windOffset * (0.7 + depth * 0.12) + Math.sin(now / (1900 + index * 23) + index * 1.7) * 8
        : windOffset,
    x = wrap(index * 193.31 + drift, width + 80) - 40
  return { x, y, radius: 0.9 + depth * 0.6, length: 7 + depth * 4, alpha: 0.16 + depth * 0.1 }
}
/** Fixed particle count, no textures/filters or retained per-frame objects. */
export function precipitationBudget(
  weather: WorldWeather,
  kind: Precipitation | null,
  density = 1,
) {
  if (!kind) return 0
  // Snowflakes occupy more screen area; scale snowfall independently from rain.
  const base = kind === 'snow' ? (weather === 'storm' ? 116 : 46) : weather === 'storm' ? 160 : 68
  return Math.min(192, Math.ceil(base * Math.max(0, density)))
}

export function paintPrecipitation(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  weather: WorldWeather,
  regionId: string,
  wind: WorldWind = { speed: 0.018, offset: now * 0.018 },
  density = 1,
) {
  const kind = precipitationKind(weather, regionId)
  if (!kind || width <= 0 || height <= 0) return 0
  const spindrift = kind === 'snow' && weather === 'storm'
  const count = precipitationBudget(weather, kind, density)
  context.save()
  context.lineCap = 'round'
  context.lineWidth = 1
  for (let index = 0; index < count; index++) {
    const particle = precipitationParticle(kind, index, width, height, now, wind.offset)
    context.globalAlpha = spindrift ? particle.alpha * 1.35 : particle.alpha
    context.beginPath()
    if (spindrift) {
      context.strokeStyle = '#e2edf4'
      context.moveTo(particle.x, particle.y)
      context.lineTo(
        particle.x + wind.speed * (85 + particle.radius * 38),
        particle.y + particle.radius * 2,
      )
      context.stroke()
    } else if (kind === 'snow') {
      context.fillStyle = '#edf4ed'
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
      context.fill()
    } else {
      context.strokeStyle = '#c6e2e6'
      context.moveTo(particle.x, particle.y)
      context.lineTo(particle.x + particle.length * wind.speed * 2.8, particle.y + particle.length)
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
  wind: WorldWind,
  density = 1,
) {
  let count = 0
  context.save()
  if (regionId === 'glasswind-desert') {
    context.strokeStyle = '#d7bc87'
    context.lineWidth = 0.9
    for (let i = 0; i < Math.ceil(24 * density); i++) {
      const phase = (now / (6200 + i * 97) + i * 0.37) % 1,
        x = wrap(i * 97 + wind.offset * 1.4, width + 120) - 60,
        y = height * (0.22 + (i % 9) * 0.078) + Math.sin(now / 1700 + i) * 7
      context.globalAlpha = Math.sin(phase * Math.PI) * (0.12 + (i % 3) * 0.05)
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + Math.sign(wind.speed) * (3 + (i % 5)), y - 0.7)
      context.stroke()
      count++
    }
  }
  let sources = 0
  for (const emitter of emitters) {
    const point = project(emitter)
    if (point.x < -30 || point.x > width + 30 || point.y < -30 || point.y > height + 70) continue
    if (sources++ >= Math.ceil(12 * density)) break
    for (let i = 0; i < Math.ceil(4 * density); i++) {
      const phase = (now / (2100 + (emitter.seed % 1300)) + i / 4 + (emitter.seed % 997) / 997) % 1,
        x = point.x + phase * wind.speed * 470 + Math.sin(phase * 5 + emitter.seed + i) * 4,
        y = point.y - phase * (22 + (emitter.seed % 31))
      context.globalAlpha = (1 - phase) * 0.7
      const smoke = emitter.source === 'camp' && i >= 2
      context.fillStyle = smoke ? '#b8bcaf' : i % 2 ? '#ffa85b' : '#ffc985'
      if (smoke) context.globalAlpha *= 0.28
      context.beginPath()
      context.ellipse(
        x,
        smoke ? y - 12 : y,
        smoke ? 3 + phase * 9 : 1 + (i % 2) * 0.4,
        smoke ? 2 + phase * 5 : 1.5 + (i % 3) * 0.5,
        phase,
        0,
        Math.PI * 2,
      )
      context.fill()
      count++
    }
  }
  context.restore()
  return count
}

/**
 * Low-cost screen-space fog banks remain visible on low-quality and reduced-motion
 * settings. Background names and interaction markers paint on a separate layer.
 */
export function paintWeatherVeil(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  weather: WorldWeather,
  windOffset: number,
  quality = 1,
) {
  if (weather !== 'fog' && weather !== 'overcast' && weather !== 'storm') return
  const fog = weather === 'fog'
  const count = Math.max(2, Math.min(5, Math.ceil((fog ? 4 : 3) * quality)))
  context.save()
  for (let i = 0; i < count; i++) {
    const radius = width * (0.34 + (i % 3) * 0.13)
    const x =
      wrap(windOffset * (fog ? 0.17 : 0.38) + (i * width) / 2.4, width + 2 * radius) - radius
    const y = height * (0.14 + (i % 4) * 0.24)
    const bank = context.createRadialGradient(x, y, 0, x, y, radius)
    bank.addColorStop(
      0,
      fog
        ? 'rgba(194,214,213,.46)'
        : weather === 'storm'
          ? 'rgba(26,36,56,.28)'
          : 'rgba(38,46,62,.27)',
    )
    bank.addColorStop(0.46, fog ? 'rgba(171,197,198,.25)' : 'rgba(40,48,60,.13)')
    bank.addColorStop(1, 'rgba(20,34,42,0)')
    context.fillStyle = bank
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  context.restore()
}

export function regionalWeatherLabel(weather: WorldWeather, regionId: string): string {
  if (precipitationKind(weather, regionId) === 'snow')
    return weather === 'storm' ? 'Snowstorm' : 'Snow'
  return weather.charAt(0).toUpperCase() + weather.slice(1)
}

/** Leaves/pollen give clear and windy weather their own motion; wet skies keep rain/snow. */
export function airborneMoteProfile(weather: WorldWeather, petals: boolean) {
  if (weather === 'rain' || weather === 'storm' || weather === 'fog') return null
  return {
    drift: weather === 'wind' ? 2.1 : 1.15,
    width: petals ? 3.4 : weather === 'wind' ? 2.8 : 1.3,
    colour: petals
      ? 'rgba(245,189,213,.75)'
      : weather === 'wind'
        ? 'rgba(171,151,94,.62)'
        : 'rgba(225,215,160,.43)',
  }
}
