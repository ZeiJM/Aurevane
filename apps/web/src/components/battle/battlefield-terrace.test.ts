import { describe, expect, it } from 'vitest'
import {
  battlefieldTerraceLift,
  battlefieldTerraceOcclusion,
  projectBattlefieldTerracePoint,
} from './battlefield-terrace'

describe('Battle Terrace relief', () => {
  it('puts every elevated foot position above its preceding elevation', () => {
    const y = -140
    const screen = [0, 1, 2, 3].map((height) =>
      projectBattlefieldTerracePoint(40, y - battlefieldTerraceLift(height, 50), 350),
    )
    expect(screen[0]!.y).toBeGreaterThan(screen[1]!.y)
    expect(screen[1]!.y).toBeGreaterThan(screen[2]!.y)
    expect(screen[2]!.y).toBeGreaterThan(screen[3]!.y)
  })

  it('shows a partial silhouette behind a tall cliff and none beside a lower summit', () => {
    const screenY = (y: number) => projectBattlefieldTerracePoint(0, y, 350).y
    const footY = screenY(-175)
    const cliffBaseY = screenY(-125)
    const highSummitY = screenY(-125 - battlefieldTerraceLift(3, 50))
    const lowSummitY = screenY(-125 - battlefieldTerraceLift(1, 50))
    expect(battlefieldTerraceOcclusion(footY, 100, highSummitY, cliffBaseY)).toBeGreaterThan(0)
    expect(battlefieldTerraceOcclusion(footY, 100, lowSummitY, cliffBaseY)).toBe(0)
    expect(battlefieldTerraceOcclusion(cliffBaseY, 100, highSummitY, footY)).toBe(0)
  })
})
