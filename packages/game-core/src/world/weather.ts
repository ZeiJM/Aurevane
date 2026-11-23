export const WORLD_WEATHER = ['clear', 'overcast', 'rain', 'storm', 'fog', 'wind'] as const
export type WorldWeather = (typeof WORLD_WEATHER)[number]

const STAY = 0.5
const LOOKBACK_HOURS = 96 // look-back, in six-hour weather blocks
const TRANSITIONS: Record<WorldWeather, Partial<Record<WorldWeather, number>>> = {
  clear: { overcast: 0.4, wind: 0.25, fog: 0.2, rain: 0.15 },
  overcast: { clear: 0.35, rain: 0.35, fog: 0.1, wind: 0.1, storm: 0.1 },
  rain: { overcast: 0.4, storm: 0.25, clear: 0.2, fog: 0.15 },
  storm: { rain: 0.5, overcast: 0.4, clear: 0.1 },
  fog: { clear: 0.5, overcast: 0.35, rain: 0.15 },
  wind: { clear: 0.4, overcast: 0.35, rain: 0.15, storm: 0.1 },
}

function hash(n: number): number {
  let t = (n + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const weatherCache = new Map<number, WorldWeather>()

export function weatherAtHour(hourIndex: number): WorldWeather {
  const h = Math.floor(hourIndex)
  const cached = weatherCache.get(h)
  if (cached) return cached
  let w: WorldWeather = 'clear'
  for (let i = h - LOOKBACK_HOURS; i <= h; i++) {
    if (hash(i) < STAY) continue
    let acc = 0
    const r = hash(i + 7919)
    for (const [k, p] of Object.entries(TRANSITIONS[w]) as [WorldWeather, number][]) {
      acc += p
      if (r < acc) {
        w = k
        break
      }
    }
  }
  if (weatherCache.size > 4096) weatherCache.clear()
  weatherCache.set(h, w)
  return w
}

export function isWorldWeather(value: unknown): value is WorldWeather {
  return typeof value === 'string' && (WORLD_WEATHER as readonly string[]).includes(value)
}
