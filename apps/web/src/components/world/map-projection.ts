import type { MapPoint } from './world-motion'
export const MAP_X = 0.85,
  MAP_Y = 0.44
export function projectMapPoint(
  point: MapPoint,
  camera: MapPoint,
  pan: MapPoint,
  tile: number,
  width: number,
  height: number,
) {
  const x = point.x - camera.x - pan.x,
    y = point.y - camera.y - pan.y
  return { x: width / 2 + (x - y) * tile * MAP_X, y: height / 2 + (x + y) * tile * MAP_Y }
}
export function unprojectMapPoint(
  point: MapPoint,
  camera: MapPoint,
  pan: MapPoint,
  tile: number,
  width: number,
  height: number,
) {
  const x = (point.x - width / 2) / (tile * MAP_X),
    y = (point.y - height / 2) / (tile * MAP_Y)
  return { x: (x + y) / 2 + camera.x + pan.x, y: (y - x) / 2 + camera.y + pan.y }
}
