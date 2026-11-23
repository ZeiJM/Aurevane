import 'server-only'

// Private tile-plane geography. This is never an atlas mask or globe texture.
// The old districts occupy the northwest; three broad overlapping continental
// plates extend them into a connected 832 × 432 tile landmass.
const inside = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2

export function supercontinentTerrain(x: number, y: number, seed: number, legacy = false) {
  const coast = 1 + Math.sin(y * 0.047 + seed) * 0.023 + Math.cos(x * 0.038 - seed) * 0.017
  const land = Math.min(
    inside(x, y, 430, 225, 390, 198),
    inside(x, y, 560, 95, 245, 82),
    inside(x, y, 620, 320, 200, 94),
    inside(x, y, 170, 315, 145, 85),
    legacy ? inside(x, y, 100, 90, 95, 83) : Infinity,
  )
  if (land >= coast) return '~'
  // Each realm carries its defining terrain into the added land, rather than
  // changing only the palette of one common interior.
  if (!legacy) {
    if (seed === 1 && inside(x, y, 640, 175, 75, 40) < 1) return '~'
    if (seed === 2 && inside(x, y, 565, 335, 78, 35) < 1) return 'l'
    if (seed === 3 && (inside(x, y, 790, 172, 87, 42) < 1 || inside(x, y, 220, 403, 105, 39) < 1))
      return '~'
    if (seed === 4 && inside(x, y, 567, 174, 67, 33) < 1) return '~'
    const basin = inside(x, y, 580, 300, 80, 48)
    if (seed === 5 && basin > 0.95 && basin < 1.05 && Math.abs(x - 580) > 7) return '#'
    if (
      seed === 7 &&
      y > 85 &&
      y < 380 &&
      Math.abs(y - 176) > 7 &&
      Math.abs(y - 320) > 7 &&
      Math.abs(x - 680 - Math.sin(y * 0.04) * 10) < 2
    )
      return '#'
  }
  // Long irregular lakes and river systems, with broad dry approaches to the
  // few authored ford crossings. No per-sector roads or stamped cross pattern.
  if (
    inside(x, y, 532 + seed * 5, 184, 38, 21) < 1 ||
    inside(x, y, 306, 302 + seed * 3, 29, 17) < 1 ||
    inside(x, y, 691, 342 - seed * 4, 32, 15) < 1
  )
    return '~'
  const river = 264 + Math.sin(x * 0.018 + seed) * 20 + Math.sin(x * 0.041) * 6
  if (x > 195 && Math.abs(y - river) < (!legacy && seed === 6 ? 4.3 : 2.3)) {
    if (Math.abs(x - 445) < 3 || Math.abs(x - 654) < 3) return '='
    return !legacy && seed === 2 ? 'l' : '~'
  }
  const ridge = 603 + Math.sin(y * 0.027 + seed) * 16
  if (y > 75 && y < 236 && Math.abs(x - ridge) < 1.5 && Math.abs(y - 143) > 5) return '#'
  const grove = Math.sin(x * 0.043 + seed) * Math.cos(y * 0.031)
  return ((x * 37 + y * 61 + seed * 17) % 101) / 101 < 0.12 + grove * 0.09 ? 't' : '.'
}
