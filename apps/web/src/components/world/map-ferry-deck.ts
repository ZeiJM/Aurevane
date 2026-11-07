import { hashString } from '@/world/terrain-gen'
import type { WorldSectorView } from '@/world/types'

type DeckCell = WorldSectorView['cells'][number]

/** Cached deck material and brass gunwale, projected with the existing square tile. */
export function paintFerryDeck(
  context: CanvasRenderingContext2D,
  cell: DeckCell,
  tile: number,
  deck: ReadonlySet<string>,
) {
  const x = cell.x * tile
  const y = cell.y * tile
  const wood = ['#846044', '#8e6849', '#9a7651', '#90654a']
  const plank = tile / 7
  for (let row = 0; row < 7; row++) {
    const seed = hashString(`deck:${cell.x}:${cell.y}:${row}`)
    context.fillStyle = wood[seed % wood.length]!
    context.fillRect(x, y + row * plank, tile + 0.5, plank + 0.5)
    context.fillStyle = 'rgba(46,29,23,.35)'
    context.fillRect(x, y + (row + 1) * plank - 0.7, tile, 0.7)
    context.fillStyle = 'rgba(224,184,126,.28)'
    context.fillRect(x + ((seed >>> 8) % 13) * (tile / 24), y + row * plank + 2, tile * 0.38, 0.7)
  }
  const rim = Math.max(2, tile * 0.07)
  const edge = (left: number, top: number, width: number, height: number) => {
    context.fillStyle = '#382c29'
    context.fillRect(left, top, width, height)
    context.fillStyle = '#ad8e54'
    context.fillRect(left + 0.6, top + 0.6, Math.max(1, width - 1.2), Math.max(1, height - 1.2))
  }
  if (!deck.has(`${cell.x - 1}:${cell.y}`)) edge(x, y, rim, tile)
  if (!deck.has(`${cell.x + 1}:${cell.y}`)) edge(x + tile - rim, y, rim, tile)
  if (!deck.has(`${cell.x}:${cell.y - 1}`)) edge(x, y, tile, rim)
  if (!deck.has(`${cell.x}:${cell.y + 1}`)) edge(x, y + tile - rim, tile, rim)
}
