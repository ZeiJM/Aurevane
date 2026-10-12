import type { WorldAtlasCell } from '@/world/types'

const colors: Record<string, readonly number[]> = {
  'verdant-expanse': [83, 121, 75],
  'aureth-crown': [153, 147, 91],
  frostmere: [173, 193, 199],
  'hollow-coast': [107, 142, 134],
  'glasswind-desert': [199, 173, 121],
  emberreach: [128, 83, 65],
  'starfall-highlands': [145, 140, 163],
  'umbral-march': [58, 85, 78],
}
/** RGBA map cells come only from the server's charted overview. Ocean/private cells
 * remain transparent; this texture contains no undiscovered identities or terrain. */
export function globeAtlasPixels(atlas: readonly WorldAtlasCell[], columns: number, rows: number) {
  const pixels = new Uint8Array(columns * rows * 4)
  for (const cell of atlas) {
    if (
      !cell.charted ||
      cell.column < 0 ||
      cell.column >= columns ||
      cell.row < 0 ||
      cell.row >= rows
    )
      continue
    const index = (cell.row * columns + cell.column) * 4
    pixels.set([...(colors[cell.regionId] ?? colors['verdant-expanse']!), 255], index)
  }
  return pixels
}
