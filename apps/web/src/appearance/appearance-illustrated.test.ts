import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/media/appearance/[version]/[blueprint]/[asset]/route'
import { APPEARANCE_BACKDROPS, PATTERNED_BACKDROPS } from './appearance-backdrop-catalog'
import { PORTRAIT_FACES } from './appearance-face-catalog'
import {
  APPEARANCE_EXPRESSIONS,
  parseAppearanceBlueprint,
  appearanceManifestFromImageUrl,
  compileAppearanceManifest,
} from './appearance-manifest'
import {
  appearanceGenderForIdentity,
  defaultPaintedLookForGender,
  paintedPlayerAppearanceBlueprint,
  randomPaintedLookForGender,
} from './appearance-painted-looks'
import { illustratedPortrait } from './appearance-illustrated'
import { ILLUSTRATED_STARTER_GALLERY } from './appearance-starter-gallery'
import { renderAppearanceAsset } from './appearance-svg'
import { APPEARANCE_AGES, PLAYER_HAIRSTYLES, WARDROBE_GEAR } from './appearance-painted-wardrobe'

const svg = (look: ReturnType<typeof paintedPlayerAppearanceBlueprint>) =>
  illustratedPortrait(look, 'neutral', false)

describe('illustrated player and NPC customization', () => {
  it('triples the face choices for each gender and makes all 48 hair silhouettes visible', () => {
    for (const [gender, total] of [
      ['feminine', 198],
      ['masculine', 201],
    ] as const) {
      const faces = PORTRAIT_FACES.filter(({ rig }) => appearanceGenderForIdentity(rig) === gender)
      expect(faces).toHaveLength(total)
      expect(
        new Set(
          faces.map(({ rig, id }) =>
            svg(
              paintedPlayerAppearanceBlueprint({
                ...defaultPaintedLookForGender(gender),
                identity: rig,
                faceId: id,
              }),
            ),
          ),
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
      expect(portrait).toContain('M151 116l13 15')
      expect(portrait).toContain('hair-pigment')
      expect(portrait).toContain('rgb(91,138,185)')
      expect(portrait).toContain('rgb(67,45,40)')
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

  it('renders the full starter portrait catalogue using shared customization recipes', () => {
    const looks = [...ILLUSTRATED_STARTER_GALLERY.values()]
    expect(looks).toHaveLength(64)
    expect(new Set(looks.map(({ manifest }) => manifest.portraits.neutral)).size).toBe(64)
    for (const { manifest, name } of looks) {
      expect(name).toBeTruthy()
      expect(appearanceManifestFromImageUrl(manifest.portraits.neutral)?.id).toBe(manifest.id)
      expect(manifest.motionAtlas).toMatch(/illustrated-motion-v2[.]svg$/)
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
    const { data, info } = await sharp(Buffer.from(motion))
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
