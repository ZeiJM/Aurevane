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
    fittedOutfit = false,
  ) =>
    renderPaintedSpriteRig({
      facing,
      pose,
      frame,
      frames: 8,
      face: fittedOutfit ? '<use href="#test-face"/>' : undefined,
      head: '<use href="#test-head"/>',
      bodyBuild: 1,
      cape: true,
      mantle: true,
      satchel: true,
      fittedOutfit,
    })

  it('paints both arms and legs in the logical rig for every facing, pose and frame', () => {
    for (const facing of APPEARANCE_FACINGS) {
      for (const pose of APPEARANCE_POSES) {
        for (let frame = 0; frame < 8; frame++) {
          const svg = render(facing, pose, frame)
          expect(svg.match(/data-rig-arm=/g)).toHaveLength(2)
          expect(svg.match(/href="#rig-hand"/g)).toHaveLength(2)
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
    expect(paintedSpriteRigDefinitions()).toContain('id="rig-hand" href="data:image/webp;base64,')
  })

  it('uses the selected outfit throughout all views and frames', () => {
    for (const facing of APPEARANCE_FACINGS) {
      const part = facing === 'south' ? 'front' : facing === 'north' ? 'back' : 'side'
      for (const pose of APPEARANCE_POSES) {
        const svg = render(facing, pose, 2, true)
        expect(svg).toContain(`href="#rig-worn-outfit-${part}"`)
        expect(svg).toContain('href="#rig-worn-outfit-sleeve"')
        expect(svg).not.toContain('href="#rig-torso')
        const torso = svg.indexOf(`href="#rig-worn-outfit-${part}"`)
        expect(svg.indexOf('href="#test-face"')).toBeLessThan(torso)
        expect(svg.indexOf('href="#test-head"')).toBeGreaterThan(torso)
      }
    }
  })

  it('swings each arm against the leg on its side during a profile walk', () => {
    for (const [frame, legSign] of [
      [2, 1],
      [6, -1],
    ] as const) {
      const svg = render('east', 'walk', frame)
      const arm = svg.split('data-limb="arm-right"')[1]!
      const leg = svg.split('data-rig-leg="near"')[1]!
      const armAngle = Number(arm.match(/href="#rig-armFront"[^>]+rotate\(([^)]+)/)?.[1])
      const legAngle = Number(leg.match(/href="#rig-thigh"[^>]+rotate\(([^)]+)/)?.[1])
      expect(Math.sign(legAngle)).toBe(legSign)
      expect(Math.sign(armAngle)).toBe(-legSign)
    }
  })
})
