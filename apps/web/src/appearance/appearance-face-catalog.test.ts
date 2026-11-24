import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { PORTRAIT_FACES } from './appearance-face-catalog'
import { facePainting } from './appearance-face-paint'
import {
  APPEARANCE_EXPRESSIONS,
  appearanceManifestFromImageUrl,
  compileAppearanceManifest,
  parseAppearanceBlueprint,
} from './appearance-manifest'
import {
  appearanceGenderForIdentity,
  defaultPaintedLookForGender,
  paintedPlayerAppearanceBlueprint,
} from './appearance-painted-looks'
import { renderAppearanceAsset } from './appearance-svg'

describe('registered player face art', () => {
  it('resolves 64 different painted identities and five expressions per gender from their saved URLs', () => {
    for (const gender of ['masculine', 'feminine'] as const) {
      const hashes = new Set<string>()
      const faces = PORTRAIT_FACES.filter(
        (face) => face.painted && appearanceGenderForIdentity(face.rig) === gender,
      )
      expect(faces).toHaveLength(64)
      for (const face of faces) {
        const blueprint = paintedPlayerAppearanceBlueprint({
          ...defaultPaintedLookForGender(gender),
          faceId: face.id,
          identity: face.rig,
          backdrop: 'plumstudio',
        })
        const manifest = compileAppearanceManifest(blueprint)
        expect(parseAppearanceBlueprint(blueprint)).toEqual(blueprint)
        expect(appearanceManifestFromImageUrl(manifest.portraits.neutral)?.blueprint).toEqual(
          blueprint,
        )
        const painting = facePainting(face.id)!
        expect(painting.front).toMatch(/^data:image\/webp;base64,/)
        for (const mood of APPEARANCE_EXPRESSIONS) {
          expect(painting.fit[mood].eyes[1][0]).toBeGreaterThan(painting.fit[mood].eyes[0][0])
          hashes.add(createHash('sha256').update(painting.poses[mood]).digest('hex'))
        }
      }
      expect(hashes.size).toBe(64 * 5)
    }
  })
  it('uses the selected painting in the portrait, icon and animated map and battle sprite', () => {
    const look = paintedPlayerAppearanceBlueprint({
      ...defaultPaintedLookForGender('feminine'),
      identity: 'ranger',
      faceId: 'f64',
      backdrop: 'pinegreen',
      headwear: 'furcap',
      facewear: 'goggles',
    })
    const paint = facePainting('f64')!
    for (const mood of APPEARANCE_EXPRESSIONS)
      expect(renderAppearanceAsset(look, mood)).toContain(paint.poses[mood])
    expect(renderAppearanceAsset(look, 'icon')).toContain(paint.poses.neutral)
    expect(renderAppearanceAsset(look, 'motion-v2')).toContain(paint.front)
    expect(parseAppearanceBlueprint({ ...look, faceId: 'f00' })).toBeNull()
    expect(parseAppearanceBlueprint({ ...look, identity: 'scout' })).toBeNull()
  })
})
