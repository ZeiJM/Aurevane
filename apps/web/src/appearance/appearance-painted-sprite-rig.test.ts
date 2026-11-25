import { describe, expect, it } from 'vitest'
import { APPEARANCE_FACINGS, APPEARANCE_POSES } from './appearance-manifest'
import {
  paintedSpriteRigDefinitions,
  renderPaintedSpriteRig,
} from './appearance-painted-sprite-rig'

describe('painted sprite rig', () => {
  const render = (
    facing: (typeof APPEARANCE_FACINGS)[number],
    pose: (typeof APPEARANCE_POSES)[number],
    frame: number,
  ) =>
    renderPaintedSpriteRig({
      facing,
      pose,
      frame,
      frames: 8,
      head: '<use href="#test-head"/>',
      bodyBuild: 1,
      cape: true,
      mantle: true,
      satchel: true,
    })

  it('paints both arms and legs in the logical rig for every facing, pose and frame', () => {
    for (const facing of APPEARANCE_FACINGS) {
      for (const pose of APPEARANCE_POSES) {
        for (let frame = 0; frame < 8; frame++) {
          const svg = render(facing, pose, frame)
          expect(svg.match(/data-rig-arm=/g)).toHaveLength(2)
          expect(svg.match(/data-rig-leg=/g)).toHaveLength(2)
          expect(svg).not.toMatch(/undefined|NaN/)
        }
      }
    }
  })

  it('uses independently articulated arm and leg positions instead of repeating an idle crop', () => {
    expect(render('east', 'walk', 2)).not.toBe(render('east', 'walk', 6))
    expect(render('east', 'cast', 2)).not.toBe(render('east', 'idle', 2))
    expect(render('west', 'walk', 6)).toContain('translate(48 0) scale(-1 1)')
    expect(paintedSpriteRigDefinitions().match(/data:image\/webp;base64,/g)).toHaveLength(12)
  })
})
