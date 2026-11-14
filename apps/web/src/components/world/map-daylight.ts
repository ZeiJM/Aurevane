import type { WorldWeather } from '@/world/environment'

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const fade = (a: number, b: number, n: number) => {
  const t = clamp((n - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Pure in-game light profile: 06:00 sunrise, noon peak, 19:00 moonlight. */
export function worldLightProfile(minuteOfDay: number, weather: WorldWeather) {
  const minute = ((minuteOfDay % 1440) + 1440) % 1440
  const daylight = fade(310, 550, minute) * (1 - fade(990, 1180, minute))
  const moonlight = 1 - fade(300, 480, minute) + fade(1090, 1190, minute)
  const dawn = fade(320, 405, minute) * (1 - fade(485, 595, minute))
  const dusk = fade(1000, 1100, minute) * (1 - fade(1180, 1270, minute))
  const cloud =
    weather === 'overcast'
      ? 0.27
      : weather === 'storm'
        ? 0.37
        : weather === 'rain'
          ? 0.13
          : weather === 'fog'
            ? 0.105
            : 0
  return {
    minute,
    daylight,
    moonlight: clamp(moonlight),
    dawn,
    dusk,
    // Moonlight is visibly blue/indigo, not an opaque dark screen.
    nightAlpha: 0.045 + (1 - daylight) * 0.34,
    cloudAlpha: cloud,
    peakBrightness: daylight * (1 - cloud),
  }
}

/** One color overlay and a bounded atmospheric glow, never a per-tile lighting loop. */
export function paintWorldLighting(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  minuteOfDay: number,
  weather: WorldWeather,
) {
  const light = worldLightProfile(minuteOfDay, weather)
  context.save()
  context.fillStyle = 'rgba(12,27,65,' + light.nightAlpha.toFixed(4) + ')'
  context.fillRect(0, 0, width, height)
  if (light.cloudAlpha > 0) {
    context.fillStyle = 'rgba(25,32,46,' + light.cloudAlpha.toFixed(4) + ')'
    context.fillRect(0, 0, width, height)
  }
  const twilight = Math.max(light.dawn, light.dusk)
  if (twilight > 0.01) {
    const tint = context.createLinearGradient(0, height, 0, 0)
    tint.addColorStop(0, 'rgba(227,151,103,' + (twilight * 0.22).toFixed(4) + ')')
    tint.addColorStop(1, 'rgba(217,141,143,0)')
    context.fillStyle = tint
    context.fillRect(0, 0, width, height)
  }
  if (light.moonlight > 0.025) {
    const moon = context.createRadialGradient(
      width * 0.82,
      height * 0.09,
      0,
      width * 0.82,
      height * 0.09,
      Math.max(width, height) * 0.8,
    )
    moon.addColorStop(0, 'rgba(145,179,228,' + (light.moonlight * 0.13).toFixed(4) + ')')
    moon.addColorStop(1, 'rgba(94,116,175,0)')
    context.fillStyle = moon
    context.fillRect(0, 0, width, height)
  }
  context.restore()
}
