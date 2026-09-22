export interface GlobeLocation {
  longitude: number
  latitude: number
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
