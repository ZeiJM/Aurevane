import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  APPEARANCE_EXPRESSIONS,
  APPEARANCE_PRESETS,
  appearanceManifestFromImageUrl,
  compileAppearanceManifest,
  parseAppearanceBlueprint,
} from './appearance-manifest'
import {
  APPEARANCE_BACKDROPS,
  PATTERNED_BACKDROPS,
  STUDIO_COLORS,
} from './appearance-backdrop-catalog'
import {
  APPEARANCE_GENDERS,
  CURATED_PAINTED_LOOKS,
  appearanceGenderForIdentity,
  defaultPaintedLookForGender,
  paintedIdentitiesForGender,
  paintedPlayerAppearanceBlueprint,
  randomPaintedLookForGender,
  type AppearanceGender,
} from './appearance-painted-looks'
import { PAINTED_BACKDROPS } from './appearance-painted-backdrops.generated'
import { PAINTED_HAIRSTYLES } from './appearance-painted-hairstyles.generated'
import { PAINTED_PORTRAIT_GARMENTS } from './appearance-painted-portrait-garments.generated'
import { PAINTED_PLAYER_FIELDS, type PaintedPlayerLook } from './appearance-painted-wardrobe'
import { renderAppearanceAsset } from './appearance-svg'

const digest = (output: string) => createHash('sha256').update(output).digest('hex')

describe('painted player appearance', () => {
  it('offers 120 canonical painted looks with five expressions and a distinct sprite atlas each', () => {
    const ids = new Set<string>()
    const portraits = new Set<string>()
    const sprites = new Set<string>()
    for (const { gender, look } of CURATED_PAINTED_LOOKS) {
      expect(paintedIdentitiesForGender(gender)).toContain(look.identity)
      expect(appearanceGenderForIdentity(look.identity)).toBe(gender)
      const blueprint = paintedPlayerAppearanceBlueprint(look)
      const manifest = compileAppearanceManifest(blueprint)
      expect(parseAppearanceBlueprint(blueprint)).toEqual(blueprint)
      expect(appearanceManifestFromImageUrl(manifest.portraits.neutral)?.id).toBe(manifest.id)
      ids.add(manifest.id)
      for (const expression of APPEARANCE_EXPRESSIONS) {
        const portrait = renderAppearanceAsset(blueprint, expression)
        expect(portrait).toContain('<image')
        expect(portrait).toContain('data:image/')
        portraits.add(digest(portrait))
      }
      sprites.add(digest(renderAppearanceAsset(blueprint, 'atlas')))
    }
    expect(ids.size).toBe(120)
    expect(portraits.size).toBe(120 * APPEARANCE_EXPRESSIONS.length)
    expect(sprites.size).toBe(120)
  })

  it('preserves the exact Pine Scout plates in the original feminine look', () => {
    const blueprint = paintedPlayerAppearanceBlueprint(defaultPaintedLookForGender('feminine'))
    for (const expression of APPEARANCE_EXPRESSIONS) {
      expect(renderAppearanceAsset(blueprint, expression)).toEqual(
        renderAppearanceAsset(APPEARANCE_PRESETS[0].blueprint, expression),
      )
    }
  })

  it('applies the same customization fields to both art views for every face', () => {
    const changes: Partial<PaintedPlayerLook>[] = [
      { outerwear: 'brigandine' },
      { clothColor: 'plum' },
      { gear: 'journal' },
      { gearColor: 'gold' },
      { headwear: 'circlet' },
      { headColor: 'silver' },
      { facewear: 'goggles' },
      { faceColor: 'walnut' },
      { bodyFrame: 'broad' },
      { skinTone: 'umber' },
      { hairstyle: 'braid' },
      { hairDye: 'copper' },
      { eyeColor: 'green' },
    ]
    for (const identity of Object.keys(
      PAINTED_PLAYER_FIELDS.identity,
    ) as PaintedPlayerLook['identity'][]) {
      const base = {
        ...defaultPaintedLookForGender(appearanceGenderForIdentity(identity)),
        identity,
        outerwear: 'compass',
        gear: 'mapcase',
        headwear: 'bandana',
        facewear: 'eyepatch',
      } as const
      const original = paintedPlayerAppearanceBlueprint(base)
      const portrait = digest(renderAppearanceAsset(original, 'neutral'))
      const atlas = digest(renderAppearanceAsset(original, 'atlas'))
      for (const parts of changes) {
        const altered = paintedPlayerAppearanceBlueprint({ ...base, ...parts })
        const alteredPortrait = renderAppearanceAsset(altered, 'neutral')
        const alteredAtlas = renderAppearanceAsset(altered, 'atlas')
        expect(digest(alteredPortrait)).not.toBe(portrait)
        expect(digest(alteredAtlas)).not.toBe(atlas)
        if (parts.outerwear === 'brigandine')
          expect(alteredPortrait).toContain(PAINTED_PORTRAIT_GARMENTS.brigandine.uri)
        if (parts.hairstyle === 'braid') {
          expect(alteredPortrait).toContain(PAINTED_HAIRSTYLES.braid.uri)
          expect(alteredAtlas).toContain(PAINTED_HAIRSTYLES.braid.uri)
        }
      }
    }
  })

  it('uses settings only for portraits and randomizes within the selected gender', () => {
    const genderChoices = Object.keys(APPEARANCE_GENDERS) as AppearanceGender[]
    expect(
      new Set([
        ...Object.keys(PAINTED_BACKDROPS),
        ...Object.keys(STUDIO_COLORS),
        ...Object.keys(PATTERNED_BACKDROPS),
      ]),
    ).toEqual(new Set(Object.keys(APPEARANCE_BACKDROPS)))
    expect(new Set(Object.values(PAINTED_BACKDROPS)).size).toBe(50)
    for (const gender of genderChoices) {
      const look = defaultPaintedLookForGender(gender)
      const original = paintedPlayerAppearanceBlueprint(look)
      const alternative = paintedPlayerAppearanceBlueprint({ ...look, backdrop: 'lunar' })
      expect(renderAppearanceAsset(alternative, 'neutral')).toContain(PAINTED_BACKDROPS.lunar)
      expect(renderAppearanceAsset(alternative, 'atlas')).toEqual(
        renderAppearanceAsset(original, 'atlas'),
      )
      const first = randomPaintedLookForGender(gender, () => 0)
      const second = randomPaintedLookForGender(gender, () => 0, first)
      expect(appearanceGenderForIdentity(second.identity)).toBe(gender)
      expect(second).not.toEqual(first)
    }
  })

  it('rejects unresolved settings, the new identity in legacy versions and noncanonical color variants', () => {
    const look = defaultPaintedLookForGender('feminine')
    const manifest = compileAppearanceManifest(paintedPlayerAppearanceBlueprint(look))
    const url = manifest.portraits.neutral
    expect(appearanceManifestFromImageUrl(url.replace('.original/', '.madeup/'))).toBeNull()
    expect(appearanceManifestFromImageUrl(url.replace('.original/', '/'))).toBeNull()
    expect(
      appearanceManifestFromImageUrl(
        url.replace('.original/', '.natural.natural.natural.original/'),
      ),
    ).toBeNull()
    expect(
      appearanceManifestFromImageUrl(url.replace('/6/', '/5/').replace('.original/', '/')),
    ).toBeNull()
    expect(appearanceManifestFromImageUrl(url.replace('.none.natural.', '.none.ochre.'))).toBeNull()
  })
})
