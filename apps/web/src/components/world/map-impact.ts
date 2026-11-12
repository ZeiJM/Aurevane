import type { WorldSectorView } from '@/world/types'

export function impactSite(sector: WorldSectorView): WorldSectorView['impactSite'] {
  const site = sector.impactSite
  if (!site || sector.townId || (!sector.charted && !sector.warpedTheme)) return
  const left = site.x - site.size / 2,
    top = site.y - site.size / 2,
    right = left + site.size,
    bottom = top + site.size
  const overlaps = (x: number, y: number, width = 1, height = 1) =>
    x < right && x + width > left && y < bottom && y + height > top
  if (sector.buildings?.some((b) => overlaps(b.x, b.y, b.width, b.height))) return
  // Keep authored focal scenery and its immediate ground clear of a new stamp.
  if (sector.landmarks.some((p) => overlaps(p.x - 1, p.y - 1, 3, 3))) return
  if (
    sector.warpedScenery &&
    overlaps(sector.warpedScenery.x - 1, sector.warpedScenery.y - 1, 3, 3)
  )
    return
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      const cell = sector.cells.find((c) => c.x === x && c.y === y)
      if (!cell || cell.safe || !cell.walkable || (cell.terrain !== '.' && cell.terrain !== 't'))
        return
    }
  return { ...site }
}

/** Static ground only; absent/undecoded art leaves the ordinary terrain intact. */
export function paintImpactGround(
  context: CanvasRenderingContext2D,
  sector: WorldSectorView,
  tile: number,
  material?: HTMLImageElement,
): boolean {
  const site = impactSite(sector)
  if (
    !site ||
    !material?.complete ||
    !material.naturalWidth ||
    !material.naturalHeight ||
    tile <= 0
  )
    return false
  const panel = material.naturalWidth / 3
  if (panel !== material.naturalHeight) return false
  const left = site.x - site.size / 2,
    top = site.y - site.size / 2
  context.save()
  context.beginPath()
  // The complete footprint was proved above; clip explicitly to those supplied cells.
  for (const cell of sector.cells)
    if (cell.x >= left && cell.x < left + site.size && cell.y >= top && cell.y < top + site.size)
      context.rect(cell.x * tile, cell.y * tile, tile, tile)
  context.clip()
  context.drawImage(
    material,
    site.index * panel,
    0,
    panel,
    panel,
    left * tile,
    top * tile,
    site.size * tile,
    site.size * tile,
  )
  context.restore()
  return true
}
