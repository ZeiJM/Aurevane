export interface GlobeLocation {
  longitude: number
  latitude: number
}
export function globeSectorCenter(
  coordinate: string,
  columns = 32,
  rows = 16,
): GlobeLocation | null {
  const match = /^S(\d{2})-(\d{2})$/.exec(coordinate)
  if (!match) return null
  const east = Number(match[1]),
    north = Number(match[2])
  if (east < 1 || east > columns || north < 1 || north > rows) return null
  return {
    longitude: (east - 0.5) * (360 / columns) - 180,
    latitude: 90 - (north - 0.5) * (180 / rows),
  }
}
export function globeSectorCoordinate(
  location: GlobeLocation,
  columns = 32,
  rows = 16,
): string | null {
  if (
    !Number.isFinite(location.longitude) ||
    !Number.isFinite(location.latitude) ||
    location.latitude < -90 ||
    location.latitude > 90
  )
    return null
  const longitude = (((location.longitude + 180) % 360) + 360) % 360
  const east = Math.min(columns, Math.floor(longitude / (360 / columns)) + 1)
  const north = Math.min(rows, Math.floor((90 - location.latitude) / (180 / rows)) + 1)
  if (north < 1 || north > rows) return null
  return `S${String(east).padStart(2, '0')}-${String(north).padStart(2, '0')}`
}
const radians = (degrees: number) => (degrees * Math.PI) / 180
const degrees = (radians: number) => (radians * 180) / Math.PI
export function projectGlobePoint(location: GlobeLocation, camera: GlobeLocation) {
  const lon = radians(location.longitude - camera.longitude),
    lat = radians(location.latitude),
    tilt = radians(camera.latitude)
  const x = Math.cos(lat) * Math.sin(lon)
  const y = Math.sin(lat) * Math.cos(tilt) - Math.cos(lat) * Math.cos(lon) * Math.sin(tilt)
  const z = Math.sin(lat) * Math.sin(tilt) + Math.cos(lat) * Math.cos(lon) * Math.cos(tilt)
  return { x, y, visible: z > 0 }
}
export function unprojectGlobePoint(
  x: number,
  y: number,
  camera: GlobeLocation,
): GlobeLocation | null {
  if (x * x + y * y > 1) return null
  const z = Math.sqrt(Math.max(0, 1 - x * x - y * y)),
    tilt = radians(camera.latitude)
  const worldY = y * Math.cos(tilt) + z * Math.sin(tilt)
  const worldZ = z * Math.cos(tilt) - y * Math.sin(tilt)
  return {
    longitude: ((degrees(Math.atan2(x, worldZ)) + camera.longitude + 540) % 360) - 180,
    latitude: degrees(Math.asin(Math.max(-1, Math.min(1, worldY)))),
  }
}
