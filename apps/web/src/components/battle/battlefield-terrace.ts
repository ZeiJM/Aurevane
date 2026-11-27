const TERRACE_DEPTH = 0.25

export function fitBattlefieldTerrace(
  columns: number,
  rows: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  // The footprint is registered to the clear stone deck in the terrace painting.
  const width = viewportWidth * 0.79
  const height = viewportHeight * 0.64
  const depth = TERRACE_DEPTH
  if (rows < 7 || width / (columns * (1 + depth)) < 32 || height / (rows * (1 + depth)) < 24)
    return null

  // A projective transform keeps the near edge full width and the far edge narrower.
  // The tile buttons themselves are projected, so their hit areas follow the drawn grid.
  const projection = `matrix3d(1, 0, 0, 0, 0, ${1 + depth}, 0, ${-depth / height}, 0, 0, 1, 0, 0, 0, 0, 1)`
  return { width, height, projection }
}

export function battlefieldTerraceBillboard(x: number, y: number, height: number) {
  // Counter the local shear and vertical stretch at the token's ground position.
  const shear = (-x * TERRACE_DEPTH) / (height * (1 + TERRACE_DEPTH))
  const scaleY = (1 - (y * TERRACE_DEPTH) / height) / (1 + TERRACE_DEPTH)
  return `matrix(1, 0, ${shear}, ${scaleY}, 0, 0)`
}
