export const WORLD_MIN_ZOOM = 0.64
export const WORLD_MAX_ZOOM = 1.4
export const clampWorldZoom = (zoom: number) =>
  Math.max(WORLD_MIN_ZOOM, Math.min(WORLD_MAX_ZOOM, zoom))

export const worldZoomPercent = (zoom: number) =>
  Math.round((100 * (clampWorldZoom(zoom) - WORLD_MIN_ZOOM)) / (WORLD_MAX_ZOOM - WORLD_MIN_ZOOM))
export const worldZoomFromPercent = (percent: number) =>
  clampWorldZoom(WORLD_MIN_ZOOM + (WORLD_MAX_ZOOM - WORLD_MIN_ZOOM) * (percent / 100))
