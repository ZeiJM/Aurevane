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
        expect(svg.match(/href="#rig-upper-sleeve"/g)).toHaveLength(2)
        expect(svg.match(/href="#rig-lower-sleeve"/g)).toHaveLength(2)
        expect(svg).not.toContain('href="#rig-torso')
        expect(svg.match(/href="#rig-(?:visible-hand|grip-hand|casting-hand)"/g)).toHaveLength(2)
        const torso = svg.indexOf(`href="#rig-worn-outfit-${part}"`)
        expect(svg.indexOf('href="#test-face"')).toBeLessThan(torso)
        expect(svg.indexOf('href="#test-head"')).toBeGreaterThan(torso)
        if (part === 'side') {
          expect(svg).not.toContain('<svg x="20"')
          expect(svg).toMatch(
            /<svg x="0" y="[^"]+" width="48" height="22"[^>]*><g data-rig-arm="near"/,
          )
        }
      }
    }
  })

  it('fits the painted hands separately from the forearm for illustrated outfits', () => {
    const art = { front: '', back: '', side: '', sleeve: '' }
    expect(paintedSpriteRigDefinitions(art)).toContain('id="rig-visible-hand"')
    expect(paintedSpriteRigDefinitions(art)).toContain('id="rig-grip-hand"')
    expect(paintedSpriteRigDefinitions(art)).toContain('id="rig-casting-hand"')
    expect(paintedSpriteRigDefinitions(art)).toContain('id="rig-upper-sleeve"')
    expect(paintedSpriteRigDefinitions(art)).toContain('id="rig-lower-sleeve"')
    expect(paintedSpriteRigDefinitions()).not.toContain('id="rig-visible-hand"')
  })

  it('paints three distinct authored moments for each fitted pose and facing', () => {
    for (const facing of APPEARANCE_FACINGS) {
      for (const pose of APPEARANCE_POSES) {
        const frames = [0, 1, 2].map((frame) => render(facing, pose, frame, true))
        expect(new Set(frames).size, `${facing} ${pose}`).toBe(3)
        if (pose === 'down') expect(frames[0]).toContain('rotate(-90)')
      }
    }
  })

  it('bends the forearm at the elbow in a fitted profile cast', () => {
    const frame = render('east', 'cast', 1, true).split('data-rig-arm="near"')[1]!
    const rotation = (part: string) =>
      Number(frame.match(new RegExp(`href="#rig-${part}"[^>]+rotate\\(([^)]+)\\)`))?.[1])
    const upper = rotation('upper-sleeve')
    const lower = rotation('lower-sleeve')
    expect(lower).toBeLessThan(upper)
    expect(rotation('casting-hand')).toBe(lower)
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
