export const WORLD_MIN_ZOOM = 0.64
export const WORLD_MAX_ZOOM = 1.4
export const GLOBE_MAX_ZOOM = 3
export const clampWorldZoom = (zoom: number, maxZoom = WORLD_MAX_ZOOM) =>
  Math.max(WORLD_MIN_ZOOM, Math.min(maxZoom, zoom))

export const worldZoomPercent = (zoom: number, maxZoom = WORLD_MAX_ZOOM) =>
  Math.round((100 * (clampWorldZoom(zoom, maxZoom) - WORLD_MIN_ZOOM)) / (maxZoom - WORLD_MIN_ZOOM))
export const worldZoomFromPercent = (percent: number, maxZoom = WORLD_MAX_ZOOM) =>
  clampWorldZoom(WORLD_MIN_ZOOM + (maxZoom - WORLD_MIN_ZOOM) * (percent / 100), maxZoom)
