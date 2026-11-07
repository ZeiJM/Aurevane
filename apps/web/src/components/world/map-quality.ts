export const mapQualityBudgets = {
  high: { idleFps: 45, water: 72, wildlife: 12, weather: 1, surf: 3, clouds: true, foliage: 1.2 },
  balanced: { idleFps: 30, water: 60, wildlife: 12, weather: 1, surf: 3, clouds: true, foliage: 1 },
  low: { idleFps: 20, water: 20, wildlife: 5, weather: 0.35, surf: 1, clouds: false, foliage: 0 },
} as const

export type MapQuality = keyof typeof mapQualityBudgets
export const DEFAULT_MAP_QUALITY: MapQuality = 'balanced'

const qualityKey = 'aurevane.worldQuality'
const changeEvent = 'aurevane-world-quality'
let fallbackQuality: MapQuality | undefined

export function readMapQuality(): MapQuality {
  if (fallbackQuality) return fallbackQuality
  try {
    const value = localStorage.getItem(qualityKey)
    if (value === 'high' || value === 'low') return value
  } catch {}
  return DEFAULT_MAP_QUALITY
}

export function saveMapQuality(value: MapQuality) {
  fallbackQuality = value
  try {
    localStorage.setItem(qualityKey, value)
    fallbackQuality = undefined
  } catch {}
  window.dispatchEvent(new Event(changeEvent))
}

export function subscribeMapQuality(changed: () => void) {
  window.addEventListener('storage', changed)
  window.addEventListener(changeEvent, changed)
  return () => {
    window.removeEventListener('storage', changed)
    window.removeEventListener(changeEvent, changed)
  }
}

export const defaultMapQuality = () => DEFAULT_MAP_QUALITY
