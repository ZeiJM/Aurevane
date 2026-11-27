import { describe, expect, it } from 'vitest'
import {
  CATALOG_BACKDROP_ART,
  CATALOG_FACE_ART,
  CATALOG_GARMENT_ART,
  CATALOG_HAIR_ART,
  CATALOG_SPRITE_BACK,
  CATALOG_SPRITE_SIDE,
  CATALOG_SPRITE_SLEEVES,
  CATALOG_WORN_ART,
} from './appearance-catalog-art'
import { GET } from '@/app/api/media/appearance/[version]/[blueprint]/[asset]/route'
import { APPEARANCE_BACKDROPS, PATTERNED_BACKDROPS } from './appearance-backdrop-catalog'
import { FITTED_FACEWEAR, FITTED_HEADWEAR } from './appearance-fitted-accessories'
import { FITTED_HAIR_ART } from './appearance-fitted-portrait'
import { PORTRAIT_FACES } from './appearance-face-catalog'
import {
  APPEARANCE_EXPRESSIONS,
  parseAppearanceBlueprint,
  appearanceManifestFromImageUrl,
  compileAppearanceManifest,
} from './appearance-manifest'
import {
  appearanceGenderForIdentity,
  authoredPlayerLook,
  canAuthorPlayerLook,
  defaultPaintedLookForGender,
  paintedPlayerAppearanceBlueprint,
  randomPaintedLookForGender,
} from './appearance-painted-looks'
import { illustratedPortrait, illustratedSpriteMaterials } from './appearance-illustrated'
import { ILLUSTRATED_STARTER_GALLERY } from './appearance-starter-gallery'
import { renderAppearanceAsset } from './appearance-svg'
import {
  APPEARANCE_AGES,
  PLAYER_HAIRSTYLES,
  WARDROBE_GEAR,
  type PaintedPlayerLook,
} from './appearance-painted-wardrobe'

const svg = (look: ReturnType<typeof paintedPlayerAppearanceBlueprint>) =>
  illustratedPortrait(look, 'neutral', false)

describe('illustrated player and NPC customization', () => {
  it('has individual paintings for every studio, pattern and place in the backdrop catalogue', () => {
    const paintings = CATALOG_BACKDROP_ART
    expect(Object.keys(paintings).sort()).toEqual(
      ['original', ...Object.keys(APPEARANCE_BACKDROPS)].sort(),
    )
    expect(new Set(Object.values(paintings)).size).toBe(Object.keys(paintings).length)
  })

  it('round-trips a long canonical recipe with the new accessories and independent customization fields', () => {
    const recipe =
      'fitpinescoutkeen.hawkmantle.buttercup.utility.buttercup.branchlightcrown.buttercup.moonsteellenses.buttercup.natural.alabaster.loosequiff.charcoal.natural.beard-moustache.accent-charcoal.dye-underlight.eye-violet.scar-bridge.age-youthful.prestigesanctum'
    expect(recipe.length).toBeGreaterThan(225)
    const manifest = appearanceManifestFromImageUrl(`/api/media/appearance/6/${recipe}/neutral.svg`)
    expect(manifest?.id).toBe(`6/${recipe}`)
  })

  it('keeps all hair choices and their distinct fitted source art', () => {
    expect(Object.keys(FITTED_HAIR_ART).sort()).toEqual(Object.keys(PLAYER_HAIRSTYLES).sort())
    expect(
      new Set(Object.values(FITTED_HAIR_ART).map((name) => CATALOG_HAIR_ART[name].portrait.href))
        .size,
    ).toBe(48)
  })

  it('keeps the same fitted hair and clothing while swapping rendered face expressions', () => {
    const look = paintedPlayerAppearanceBlueprint({
      ...defaultPaintedLookForGender('feminine'),
      identity: 'pinescout',
      faceId: 'f01',
      outerwear: 'pine',
      hairstyle: 'waves',
      gear: 'none',
      clothColor: 'natural',
      headwear: 'none',
      headColor: 'natural',
      facewear: 'none',
      faceColor: 'natural',
    })
    const renders = APPEARANCE_EXPRESSIONS.map((mood) => renderAppearanceAsset(look, mood, true))
    expect(new Set(renders).size).toBe(5)
    expect(
      renders.every((svg) => svg.includes(CATALOG_HAIR_ART['silvertip-waves'].portrait.href)),
    ).toBe(true)
    expect(
      renders.every((svg) => svg.includes(CATALOG_GARMENT_ART['moss-cloak'].portrait.href)),
    ).toBe(true)
    expect(renders.every((svg) => svg.includes(CATALOG_FACE_ART.f20.portrait.href))).toBe(true)
    expect(renders[0]).not.toContain('feDisplacementMap')
    expect(renders.slice(1).every((svg) => svg.includes('feDisplacementMap'))).toBe(true)
  })

  it('keeps one opaque garment and blends the painted crop below the chin across builds', () => {
    const base = defaultPaintedLookForGender('feminine')
    const source = CATALOG_GARMENT_ART['moss-cloak'].portrait.href
    const widths = (['slight', 'natural', 'stocky'] as const).map((bodyFrame) => {
      const look = paintedPlayerAppearanceBlueprint({ ...base, outerwear: 'pine', bodyFrame })
      const portrait = renderAppearanceAsset(look, 'neutral', true)
      expect(portrait.split(source)).toHaveLength(2)
      expect(portrait).toContain('mask="url(#painted-neck-fit)"')
      const width = Number(portrait.split(source)[1]?.match(/width="([^"]+)"/)?.[1])
      const headWidth = Number(
        portrait.match(/mask="url\(#painted-neck-fit\)"[^]*?<image[^>]+width="([^"]+)"/)?.[1],
      )
      expect(width / headWidth).toBeGreaterThan(2)
      return width
    })
    expect(widths[0]).toBeLessThan(widths[1]!)
    expect(widths[1]).toBeLessThan(widths[2]!)
  })

  it('round-trips each added head and face accessory and fits the corresponding painted art', () => {
    const base = defaultPaintedLookForGender('feminine')
    for (const field of ['headwear', 'facewear'] as const) {
      const catalogue = field === 'headwear' ? FITTED_HEADWEAR : FITTED_FACEWEAR
      for (const [id, [art]] of Object.entries<readonly [keyof typeof CATALOG_WORN_ART, string]>(
        catalogue,
      )) {
        const look = paintedPlayerAppearanceBlueprint({ ...base, [field]: id })
        const manifest = compileAppearanceManifest(look)
        expect(appearanceManifestFromImageUrl(manifest.neutralUrl)?.blueprint).toEqual(look)
        for (const mood of APPEARANCE_EXPRESSIONS)
          expect(renderAppearanceAsset(look, mood)).toContain(CATALOG_WORN_ART[art].portrait.href)
        expect(renderAppearanceAsset(look, 'motion-v2')).toContain(
          CATALOG_WORN_ART[art].sprite.href,
        )
      }
    }
  })

  it('triples the face choices for each gender and makes all 48 hair silhouettes visible', () => {
    const facesByImage = new Map(
      Object.values(CATALOG_FACE_ART).map(({ portrait }) => [portrait.href as string, portrait]),
    )
    for (const [gender, total] of [
      ['feminine', 198],
      ['masculine', 201],
    ] as const) {
      const faces = PORTRAIT_FACES.filter(({ rig }) => appearanceGenderForIdentity(rig) === gender)
      expect(faces).toHaveLength(total)
      expect(
        new Set(
          faces.map(({ rig, id }) => {
            const portrait = svg(
              paintedPlayerAppearanceBlueprint({
                ...defaultPaintedLookForGender(gender),
                identity: rig,
                faceId: id,
              }),
            )
            const [, href, width, height] = portrait.match(
              /mask="url\(#painted-neck-fit\)"[^]*?<image href="([^"]+)" x="[^"]+" y="[^"]+" width="([^"]+)" height="([^"]+)"/,
            )!
            const painting = facesByImage.get(href!)!
            expect(Number(width) / Number(height), id).toBeCloseTo(
              painting.width / painting.height,
              6,
            )
            return portrait
          }),
        ).size,
      ).toBe(total)
    }
    const hair = Object.keys(PLAYER_HAIRSTYLES) as (keyof typeof PLAYER_HAIRSTYLES)[]
    expect(hair).toHaveLength(48)
    expect(
      new Set(
        hair.map((hairstyle) =>
          svg(
            paintedPlayerAppearanceBlueprint({
              ...defaultPaintedLookForGender('feminine'),
              hairstyle,
            }),
          ),
        ),
      ).size,
    ).toBe(48)
  })

  it('embeds only the selected outfit’s directional artwork and sleeve', () => {
    for (const outerwear of Object.keys(CATALOG_SPRITE_SIDE) as PaintedPlayerLook['outerwear'][]) {
      const look = paintedPlayerAppearanceBlueprint({
        ...defaultPaintedLookForGender('masculine'),
        outerwear,
      })
      const materials = illustratedSpriteMaterials(look)
      const outfit = {
        side: CATALOG_SPRITE_SIDE[outerwear],
        back: CATALOG_SPRITE_BACK[outerwear],
        sleeve: CATALOG_SPRITE_SLEEVES[outerwear],
      }
      expect(new Set(Object.values(outfit)).size).toBe(3)
      for (const direction of ['side', 'back', 'sleeve'] as const) {
        expect(
          materials.includes(`id="rig-worn-outfit-${direction}" href="${outfit[direction]}"`),
          `${outerwear} ${direction}`,
        ).toBe(true)
      }
      expect(materials).not.toContain('id="rig-torsoBack"')
    }
  })

  it('round-trips new materials and renders their visible marks, without changing the walking cell layout', async () => {
    const blueprint = paintedPlayerAppearanceBlueprint({
      ...defaultPaintedLookForGender('masculine'),
      faceId: 'm01keen',
      hairstyle: 'highpony',
      facialHair: 'anchor',
      skinTone: 'espresso',
      eyeColor: 'green',
      secondEye: 'blue',
      hairDye: 'espresso',
      hairAccent: 'silver',
      hairPlacement: 'split',
      scar: 'cross',
      backdrop: 'wavejade',
    })
    const manifest = compileAppearanceManifest(blueprint)
    expect(appearanceManifestFromImageUrl(manifest.portraits.neutral)?.blueprint).toEqual(blueprint)
    for (const mood of APPEARANCE_EXPRESSIONS) {
      const portrait = renderAppearanceAsset(blueprint, mood, true)
      expect(portrait).toMatch(
        /data-scar="cross"[^>]+>\s*<path d="M[\d.]+ [\d.]+l12 14m0-14-12 14"/,
      )
      expect(portrait).toContain('painted-hair-accent')
      expect(portrait).toContain('painted-eye-left')
      expect(portrait).toContain('painted-eye-right')
      expect(portrait).toContain('painted-skin')
      expect(portrait).toContain('data:image/webp')
    }
    const [version, id] = manifest.id.split('/') as [string, string]
    const motion = await GET(new Request('https://aurevane.invalid' + manifest.motionAtlas), {
      params: Promise.resolve({ version, blueprint: id, asset: 'illustrated-motion-v2.svg' }),
    })
    expect(motion.ok).toBe(true)
    const artwork = await motion.text()
    expect(artwork).toContain('width="1536" height="384"')
    expect(artwork.match(/data-limb="arm-left"/g)).toHaveLength(112)
    expect(artwork.match(/data-limb="arm-right"/g)).toHaveLength(112)
  })

  it('keeps a third hair color, split-color iris and new scar in a saved look', () => {
    const look = paintedPlayerAppearanceBlueprint({
      ...defaultPaintedLookForGender('feminine'),
      hairDye: 'chestnut',
      hairAccent: 'ocean',
      hairHighlight: 'silver',
      hairPlacement: 'ribbons',
      eyeColor: 'jade',
      secondEye: 'gold',
      irisPattern: 'sectoral',
      scar: 'browarch',
    })
    const manifest = compileAppearanceManifest(look)
    expect(appearanceManifestFromImageUrl(manifest.neutralUrl)?.blueprint).toEqual(look)
    const portrait = renderAppearanceAsset(look, 'neutral', true)
    expect(portrait).toContain('painted-hair-highlight')
    expect(portrait).toContain('painted-iris-accent')
    expect(portrait).toContain('data-scar="browarch"')
    expect(renderAppearanceAsset(look, 'motion-v2', true)).toContain('painted-south-highlight-fit')
  })

  it('enforces authored gender style eligibility and preserves older recipe parsing', () => {
    const earlier = paintedPlayerAppearanceBlueprint({
      ...defaultPaintedLookForGender('feminine'),
      facialHair: 'full',
      hairstyle: 'warrior',
    })
    expect(canAuthorPlayerLook(earlier)).toBe(false)
    const changed = authoredPlayerLook(earlier)
    expect(changed.facialHair).toBeUndefined()
    expect(changed.hairstyle).toBe('natural')
    expect(canAuthorPlayerLook(changed)).toBe(true)
    expect(
      appearanceManifestFromImageUrl(compileAppearanceManifest(earlier).neutralUrl)?.blueprint,
    ).toEqual(earlier)
    expect(
      canAuthorPlayerLook({
        ...defaultPaintedLookForGender('masculine'),
        hairstyle: 'twinribbons',
      }),
    ).toBe(false)
  })

  it('renders the full starter portrait catalogue using shared customization recipes', () => {
    const looks = [...ILLUSTRATED_STARTER_GALLERY.values()]
    expect(looks).toHaveLength(64)
    expect(new Set(looks.map(({ manifest }) => manifest.portraits.neutral)).size).toBe(64)
    for (const { manifest, name } of looks) {
      expect(name).toBeTruthy()
      expect(appearanceManifestFromImageUrl(manifest.portraits.neutral)?.id).toBe(manifest.id)
      expect(manifest.motionAtlas).toMatch(/illustrated-motion-v3[.]svg$/)
    }
  })

  it('shows apparent age in all five expressions and the movement atlas', () => {
    const original = defaultPaintedLookForGender('feminine')
    const ages = Object.keys(APPEARANCE_AGES) as (keyof typeof APPEARANCE_AGES)[]
    const looks = ages.map((apparentAge) =>
      paintedPlayerAppearanceBlueprint({
        ...original,
        apparentAge,
        hairstyle: 'coils',
        headwear: 'circlet',
      }),
    )
    for (const mood of APPEARANCE_EXPRESSIONS) {
      const paintings = looks.map((look) => renderAppearanceAsset(look, mood, true))
      expect(new Set(paintings).size).toBe(ages.length)
      expect(paintings[0]).not.toContain('data-age-lines')
      expect(paintings[2]).toContain('data-age-lines="mature"')
      expect(paintings[3]).toContain('data-age-lines="elder"')
    }
    for (const look of looks) {
      expect(parseAppearanceBlueprint(look)).toEqual(look)
      expect(
        appearanceManifestFromImageUrl(compileAppearanceManifest(look).neutralUrl)?.blueprint,
      ).toEqual(look)
    }
    expect(renderAppearanceAsset(looks[3]!, 'motion-v2', true)).toContain('data-age-lines="elder"')
  })

  it('draws each distinct accessory in the portrait and movement sprite', () => {
    const gear = Object.keys(WARDROBE_GEAR) as (keyof typeof WARDROBE_GEAR)[]
    const looks = gear.map((item) =>
      paintedPlayerAppearanceBlueprint({
        ...defaultPaintedLookForGender('feminine'),
        gear: item,
      }),
    )
    expect(new Set(looks.map(svg)).size).toBe(gear.length)
    expect(new Set(looks.map((look) => renderAppearanceAsset(look, 'motion-v2', true))).size).toBe(
      gear.length,
    )
  })

  it('keeps the down pose inside its sprite cell and ornaments studio settings', async () => {
    const look = paintedPlayerAppearanceBlueprint({
      ...defaultPaintedLookForGender('masculine'),
      backdrop: 'midnight',
    })
    const portrait = svg(look)
    expect(portrait).toContain('mask="url(#studio-corners)"')
    const motion = renderAppearanceAsset(look, 'motion-v2', true)
    expect(motion).toContain('translate(24 53) rotate(-90)')
    const { default: sharp } = await import('sharp')
    // libvips' SVG renderer does not decode embedded WebP. Transcode the same
    // alpha pixels for the existing cell and body coverage assertions.
    const embeddedWebP = /data:image\/webp;base64,([A-Za-z0-9+/=]+)/g
    const pngSources = await Promise.all(
      [...motion.matchAll(embeddedWebP)].map(async ([, source]) =>
        (await sharp(Buffer.from(source!, 'base64')).png().toBuffer()).toString('base64'),
      ),
    )
    let sourceIndex = 0
    const compatibleMotion = motion.replace(
      embeddedWebP,
      () => `data:image/png;base64,${pngSources[sourceIndex++]}`,
    )
    const { data, info } = await sharp(Buffer.from(compatibleMotion))
      .extract({ left: 0, top: 320, width: 48, height: 50 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let bodyPixels = 0
    for (let offset = 3; offset < data.length; offset += info.channels)
      if (data[offset]! > 128) bodyPixels++
    expect(bodyPixels).toBeGreaterThan(110)
  })

  it('keeps randomly combined expressions linked to the same portrait recipe', () => {
    let seed = 46
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32
    for (const gender of ['feminine', 'masculine'] as const)
      for (let sample = 0; sample < 65; sample++) {
        const blueprint = paintedPlayerAppearanceBlueprint(
          randomPaintedLookForGender(gender, random),
        )
        const manifest = compileAppearanceManifest(blueprint)
        const frames = APPEARANCE_EXPRESSIONS.map((mood) =>
          renderAppearanceAsset(blueprint, mood, true),
        )
        expect(Object.values(manifest.portraits).every((url) => url.includes(manifest.id))).toBe(
          true,
        )
        expect(new Set(frames).size).toBe(APPEARANCE_EXPRESSIONS.length)
        const geometry = frames.map((frame) =>
          frame.replace(/data:image\/webp;base64,[A-Za-z0-9+/=]+/g, ''),
        )
        expect(
          geometry.every((frame) => !frame.includes('undefined') && !frame.includes('NaN')),
          manifest.id,
        ).toBe(true)
      }
    expect(Object.keys(PATTERNED_BACKDROPS)).toHaveLength(10)
    const art = Object.keys(APPEARANCE_BACKDROPS).map((backdrop) =>
      svg(
        paintedPlayerAppearanceBlueprint({
          ...defaultPaintedLookForGender('masculine'),
          backdrop: backdrop as keyof typeof APPEARANCE_BACKDROPS,
        }),
      ),
    )
    expect(new Set(art).size).toBe(art.length)
  })
})
