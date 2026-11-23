/**
 * An original, northern highland spur connecting to the existing mainland.
 * This is a source of NEW charted sectors only; previously playable sectors
 * keep their canonical rows and saved positions intact.
 */
export function mountainFrontierAt(column: number, row: number): boolean {
  if (column < 42 || column > 57 || row < 5 || row > 12) return false
  const crest = 8.2 + Math.sin((column - 47) * 0.43) * 0.82
  const halfWidth = 2.24 + Math.cos((column - 48) * 0.24) * 0.37
  const taper = Math.min(1, (column - 41) / 3, (58 - column) / 3)
  return Math.abs(row - crest) <= halfWidth * taper
}
/** Canonical traversable north-south pass through otherwise blocked alpine rock. */
export function mountainFrontierPass(x: number, y: number): boolean {
  return x === 6 || y === 4
}
