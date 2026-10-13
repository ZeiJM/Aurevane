export const WORLD_MIN_ZOOM = 0.35
export const WORLD_MAX_ZOOM = 1.4
export const clampWorldZoom = (zoom: number) =>
  Math.max(WORLD_MIN_ZOOM, Math.min(WORLD_MAX_ZOOM, zoom))
