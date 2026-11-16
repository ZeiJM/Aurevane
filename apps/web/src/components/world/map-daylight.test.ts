import { expect, it } from 'vitest'
import { worldLightProfile } from './map-daylight'
it('rises into bright noon then fades toward moonlit night around 19:00', () => {
  const dawn = worldLightProfile(420, 'clear')
  const noon = worldLightProfile(720, 'clear')
  const dusk = worldLightProfile(1070, 'clear')
  const night = worldLightProfile(1200, 'clear')
  expect(noon.peakBrightness).toBeGreaterThan(dawn.peakBrightness)
  expect(noon.peakBrightness).toBeGreaterThan(dusk.peakBrightness)
  expect(night.moonlight).toBeGreaterThan(0.8)
  expect(night.nightAlpha).toBeGreaterThan(dusk.nightAlpha)
  expect(worldLightProfile(0, 'clear').nightAlpha).toBeGreaterThan(0.3)
})
it('stacks weather darkness on day and night without shifting the shared clock', () => {
  const clear = worldLightProfile(720, 'clear')
  const overcast = worldLightProfile(720, 'overcast')
  const storm = worldLightProfile(720, 'storm')
  expect(clear.cloudAlpha).toBe(0)
  expect(overcast.cloudAlpha).toBeGreaterThan(0.2)
  expect(storm.cloudAlpha).toBeGreaterThan(overcast.cloudAlpha)
  expect(clear.minute).toBe(overcast.minute)
  expect(worldLightProfile(1440, 'clear')).toEqual(worldLightProfile(0, 'clear'))
})
