import { createHash } from 'node:crypto'
import sharp from 'sharp'

import { describe, expect, it } from 'vitest'

import * as appearance from './appearance-manifest'
import { AUTHORED_CHARACTERS, authoredAppearance } from './appearance-authored-catalog'
import {
  DEFAULT_PAINTED_LOOK,
  PAINTED_CLOTHING,
  type PaintedLook,
} from './appearance-painted-catalog'
import { renderAppearanceAsset } from './appearance-svg'
import {
  PAINTED_WARDROBE_FIELDS,
  WARDROBE_DYES,
  randomWardrobeLook,
  wardrobeLook,
} from './appearance-painted-wardrobe'
import { GET } from '@/app/api/media/appearance/[version]/[blueprint]/[asset]/route'

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex')

it('round trips both authored variants and serves their own expression and sprite assets', async () => {
  const request = new Request('https://aurevane.invalid')
  for (const character of AUTHORED_CHARACTERS) {
    for (const variant of [1, 2]) {
      const blueprint = authoredAppearance(character.key, variant)
      expect(blueprint).not.toBeNull()
      const manifest = appearance.compileAppearanceManifest(blueprint!)
      expect(appearance.appearanceManifestFromImageUrl(manifest.neutralUrl)).toEqual(manifest)
      const folder = `/media/art/character-catalogue/${character.key}/variant-${variant}`
      expect(manifest.motionAtlas).toBe(`${folder}/sprites.webp`)
      for (const asset of ['icon', ...appearance.APPEARANCE_EXPRESSIONS]) {
        const response = await GET(request, {
          params: Promise.resolve({
            version: '7',
            blueprint: manifest.id.slice(2),
            asset: `${asset}.svg`,
          }),
        })
        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe(`${folder}/${asset}.webp`)
        expect(response.headers.get('Cache-Control')).toContain('immutable')
      }
    }
  }
  expect(appearance.appearanceBlueprintFromId('elf-f-0375.v1', '7')).toBeNull()
  expect(appearance.appearanceBlueprintFromId('elf-f-0001.v3', '7')).toBeNull()
})

it('round trips expanded recipes and serves every asset with immutable URLs', async () => {
  const base = wardrobeLook()
  const build = appearance.wardrobeAppearanceBlueprint
  const manifest = appearance.compileAppearanceManifest(
    build({
      ...base,
      skinTone: 'honey',
      bodyFrame: 'strong',
      outerwear: 'brigandine',
      clothColor: 'ink',
      gear: 'journal',
      gearColor: 'cedar',
      headwear: 'furcap',
      headColor: 'walnut',
      facewear: 'mask',
      faceColor: 'pewter',
    }),
  )
  expect(
    Object.values(PAINTED_WARDROBE_FIELDS).reduce(
      (sum, field) => sum + Object.keys(field).length,
      0,
    ),
  ).toBe(273)
  expect(Object.keys(WARDROBE_DYES)).toHaveLength(45)
  expect(appearance.appearanceManifestFromImageUrl(manifest.portraits.neutral)).toEqual(manifest)
  for (const asset of ['atlas', 'icon', ...appearance.APPEARANCE_EXPRESSIONS]) {
    const response = await GET(new Request('https://aurevane.invalid'), {
      params: Promise.resolve({
        version: '5',
        blueprint: manifest.id.slice(2),
        asset: `${asset}.svg`,
      }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('immutable')
  }

  expect(appearance.appearanceBlueprintFromId(manifest.id.slice(2), '4')).toBeNull()
  expect(
    appearance.appearanceBlueprintFromId(manifest.id.slice(2).replace('.honey', '.invalid'), '5'),
  ).toBeNull()
  for (let i = 0; i < 50; i++) {
    const blueprint = build(randomWardrobeLook())
    expect(appearance.parseAppearanceBlueprint(blueprint)).toEqual(blueprint)
  }
})

it.each([
  ['skinTone', 'neutral'],
  ['bodyFrame', 'atlas'],
  ['skinTone', 'atlas'],
  ['outerwear', 'atlas'],
  ['gear', 'atlas'],
  ['headwear', 'atlas'],
  ['facewear', 'atlas'],
] as const)('renders distinct %s choices in the %s asset', async (field, asset) => {
  const base = wardrobeLook()
  const build = appearance.wardrobeAppearanceBlueprint
  const values = Object.keys(PAINTED_WARDROBE_FIELDS[field])
  const hashes = await Promise.all(
    values.map(async (choice) => {
      const svg = renderAppearanceAsset(build({ ...base, [field]: choice }), asset)
      const cell =
        asset === 'neutral'
          ? svg
          : svg.replace(
              'width="576" height="384" viewBox="0 0 576 384"',
              'width="48" height="64" viewBox="0 0 48 64"',
            )
      const data = await sharp(Buffer.from(cell)).ensureAlpha().raw().toBuffer()
      return createHash('sha256').update(data).digest('hex')
    }),
  )
  expect(new Set(hashes).size).toBe(values.length)
})

it('keeps old painted recipes stable and renders each new feature independently', async () => {
  const make = appearance.wardrobeAppearanceBlueprint
  const base = wardrobeLook()
  const original = appearance.compileAppearanceManifest(make(base))
  const { hairstyle, hairDye, eyeColor, ...oldBlueprint } = original.blueprint as ReturnType<
    typeof make
  >
  expect([hairstyle, hairDye, eyeColor]).toEqual(['natural', 'natural', 'natural'])
  expect(appearance.parseAppearanceBlueprint(oldBlueprint)).toEqual(original.blueprint)
  expect(appearance.parseAppearanceBlueprint({ ...oldBlueprint, hairstyle: 'topknot' })).toBeNull()
  expect(appearance.appearanceManifestFromImageUrl(original.portraits.neutral)).toEqual(original)
  expect(
    appearance.appearanceBlueprintFromId(original.id.slice(2) + '.natural.natural.natural', '5'),
  ).toBeNull()

  const changed = appearance.compileAppearanceManifest(
    make({ ...base, hairstyle: 'braid', hairDye: 'auburn', eyeColor: 'green' }),
  )
  expect(changed.id).toBe(original.id + '.braid.auburn.green')
  expect(appearance.appearanceManifestFromImageUrl(changed.portraits.neutral)).toEqual(changed)
  expect(
    appearance.appearanceBlueprintFromId(changed.id.slice(2).replace('.green', '.opaque'), '5'),
  ).toBeNull()

  for (const field of ['hairstyle', 'hairDye', 'eyeColor'] as const) {
    for (const asset of ['neutral', 'atlas'] as const) {
      const hashes = await Promise.all(
        Object.keys(PAINTED_WARDROBE_FIELDS[field]).map(async (option) => {
          const source = renderAppearanceAsset(make({ ...base, [field]: option }), asset)
          const pixels = await sharp(Buffer.from(source)).ensureAlpha().raw().toBuffer()
          return createHash('sha256').update(pixels).digest('hex')
        }),
      )
      expect(new Set(hashes).size, `distinct ${field} in ${asset}`).toBe(hashes.length)
    }
  }
}, 30_000)

it.each(
  Object.keys(PAINTED_WARDROBE_FIELDS.identity) as Array<
    ReturnType<typeof wardrobeLook>['identity']
  >,
)(
  'renders every hairstyle distinctly on the %s base from each field direction',
  async (identity) => {
    const hairstyles = Object.keys(PAINTED_WARDROBE_FIELDS.hairstyle) as Array<
      ReturnType<typeof wardrobeLook>['hairstyle']
    >
    const portraits = new Set<string>()
    const fieldLooks = appearance.APPEARANCE_FACINGS.map(() => new Set<string>())
    const { width, height, frames } = appearance.APPEARANCE_FRAME
    for (const hairstyle of hairstyles) {
      const blueprint = appearance.wardrobeAppearanceBlueprint({
        ...wardrobeLook(),
        identity,
        hairstyle,
        hairDye: 'copper',
      })
      const portrait = await sharp(Buffer.from(renderAppearanceAsset(blueprint, 'neutral')))
        .ensureAlpha()
        .raw()
        .toBuffer()
      portraits.add(createHash('sha256').update(portrait).digest('hex'))

      const atlas = renderAppearanceAsset(blueprint, 'atlas').replace(
        'height="384" viewBox="0 0 576 384"',
        'height="64" viewBox="0 0 576 64"',
      )
      const raster = await sharp(Buffer.from(atlas)).png().toBuffer()
      await Promise.all(
        fieldLooks.map(async (looks, column) => {
          const pixels = await sharp(raster)
            .extract({
              left: column * frames * width,
              top: 0,
              width,
              height,
            })
            .ensureAlpha()
            .raw()
            .toBuffer()
          looks.add(createHash('sha256').update(pixels).digest('hex'))
        }),
      )
    }
    expect(portraits.size).toBe(hairstyles.length)
    fieldLooks.forEach((looks, index) =>
      expect(looks.size, appearance.APPEARANCE_FACINGS[index]).toBe(hairstyles.length),
    )
  },
  30_000,
)

describe('manual appearance manifests', () => {
  it('compiles a portable manifest with exactly five expressions and stable immutable paths', () => {
    const manifest = appearance.compileAppearanceManifest(
      appearance.APPEARANCE_PRESETS[0]!.blueprint,
    )
    expect(Object.keys(manifest.portraits)).toEqual([
      'neutral',
      'happy',
      'angry',
      'sad',
      'surprised',
    ])
    expect(appearance.appearanceManifestFromImageUrl(manifest.portraits.neutral)).toEqual(manifest)
    expect(
      appearance.appearanceManifestFromImageUrl('https://example.org' + manifest.portraits.neutral),
    ).toBeNull()
    expect(
      appearance.appearanceManifestFromImageUrl(manifest.portraits.neutral + '?v=1'),
    ).toBeNull()
  })

  it('rejects injected and incompatible assets instead of exposing a partial manifest', () => {
    const blueprint = appearance.APPEARANCE_PRESETS[0]!.blueprint
    expect(appearance.parseAppearanceBlueprint({ ...blueprint, hair: '<svg>' })).toBeNull()
    expect(
      appearance.parseAppearanceBlueprint({ ...blueprint, coat: 'mantle', accessory: 'satchel' }),
    ).toBeNull()
    expect(appearance.parseAppearanceBlueprint({ ...blueprint, v: 2 })).toBeNull()
  })

  it('draws distinct expressions and distinct actor art from the same identity', () => {
    const [first, second, third] = appearance.APPEARANCE_PRESETS
    const manifests = [first!, second!, third!].map(({ blueprint }) =>
      appearance.compileAppearanceManifest(blueprint),
    )
    const firstPortraits = appearance.APPEARANCE_EXPRESSIONS.map((expression) =>
      renderAppearanceAsset(manifests[0]!.blueprint, expression),
    )
    expect(new Set(firstPortraits).size).toBe(5)
    const atlases = manifests.map((manifest) => renderAppearanceAsset(manifest.blueprint, 'atlas'))
    expect(new Set(atlases).size).toBe(3)
    expect(atlases[0]).toContain('viewBox="0 0 576 384"')
    expect(appearance.appearanceFrameIndex('west', 'down', 2)).toEqual({ column: 11, row: 5 })
  })
  it('preserves immutable bytes for existing painted and manual recipes', () => {
    const painted = appearance.APPEARANCE_PRESETS[0]!.blueprint
    const manual = { ...painted, palette: 'ivory' } as const
    expect(sha256(renderAppearanceAsset(painted, 'neutral'))).toBe(
      'e435fc52ceeb54a1b0627a6554c648a34dae6a8bcf1f6cb4315685de5525bcc5',
    )
    expect(sha256(renderAppearanceAsset(painted, 'atlas'))).toBe(
      '0676824bf50a1209a16604c117c686318a93d6f8b653e39fd5a028ac3d1c29eb',
    )
    expect(sha256(renderAppearanceAsset(manual, 'neutral'))).toBe(
      'dd7d99690022f832abee3dff57b9ce5090427a54110bf3f0a6285c2c3590c079',
    )
    expect(sha256(renderAppearanceAsset(manual, 'atlas'))).toBe(
      'c4a16487be5583617eb8d5232569fc9601cce502c98b30f5d05fb9feaaa36279',
    )
  })

  it('accepts new wardrobe geometry without changing the v1 persisted recipe shape', () => {
    const base = appearance.APPEARANCE_PRESETS[0]!.blueprint
    const first = appearance.parseAppearanceBlueprint({ ...base, coat: 'bolero' })
    const second = appearance.parseAppearanceBlueprint({ ...base, coat: 'kaftan' })
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    const manifest = appearance.compileAppearanceManifest(first!)
    expect(manifest.portraits.neutral).toMatch(
      /^\/api\/media\/appearance\/1\/[a-z]+(\.[a-z]+){11}\/neutral\.svg$/,
    )
    expect(appearance.appearanceManifestFromImageUrl(manifest.portraits.neutral)).toEqual(manifest)
    expect(renderAppearanceAsset(first!, 'neutral')).not.toEqual(
      renderAppearanceAsset(second!, 'neutral'),
    )
    expect(renderAppearanceAsset(first!, 'atlas')).not.toEqual(
      renderAppearanceAsset(second!, 'atlas'),
    )
  })

  it('rejects choices whose geometry would hide the selected part', () => {
    const base = appearance.APPEARANCE_PRESETS[0]!.blueprint
    expect(
      appearance.parseAppearanceBlueprint({ ...base, coat: 'greatcloak', accessory: 'satchel' }),
    ).toBeNull()
    expect(
      appearance.parseAppearanceBlueprint({ ...base, coat: 'cuirass', sleeves: 'puffed' }),
    ).toBeNull()
    expect(
      appearance.parseAppearanceBlueprint({
        ...base,
        coat: 'greatcloak',
        sleeves: 'close',
        accessory: 'brooch',
      }),
    ).not.toBeNull()
  })
  it('varies the silhouette without changing identity, palette, or other compatible parts', () => {
    const base = appearance.APPEARANCE_PRESETS[0]!.blueprint
    const before = appearance.parseAppearanceBlueprint({
      ...base,
      coat: 'brigandine',
      accessory: 'satchel',
    })!
    const after = appearance.varyAppearanceOutfit(before)
    if (before.v === 7 || after.v === 7) throw new Error('Expected a legacy wardrobe recipe')
    expect(after.coat).not.toBe(before.coat)
    expect(after.coat).not.toBe('poncho')
    expect({ ...after, coat: before.coat }).toEqual(before)
    expect(appearance.parseAppearanceBlueprint(after)).toEqual(after)
  })
  it('versions a compatible lower garment without changing the original outfit recipe or face', () => {
    const base = appearance.parseAppearanceBlueprint({
      ...appearance.APPEARANCE_PRESETS[0].blueprint,
      coat: 'bolero',
    })!
    const changed = appearance.withLowerGarment(base, 'kilt')!
    expect(changed).toEqual({ ...base, v: 2, lower: 'kilt' })
    const manifest = appearance.compileAppearanceManifest(changed)
    expect(manifest.id).toMatch(/^2\/.+\.kilt$/)
    expect(appearance.appearanceManifestFromImageUrl(manifest.portraits.neutral)).toEqual(manifest)
    expect(
      appearance.appearanceManifestFromImageUrl(manifest.portraits.neutral.replace('/2/', '/1/')),
    ).toBeNull()
    expect(appearance.withLowerGarment(changed, 'original')).toEqual(base)
    expect(renderAppearanceAsset(changed, 'neutral')).toBe(renderAppearanceAsset(base, 'neutral'))
    expect(renderAppearanceAsset(changed, 'atlas')).not.toBe(renderAppearanceAsset(base, 'atlas'))
  })

  it('rejects hidden geometry and aliases at the persisted recipe boundary', () => {
    const base = appearance.APPEARANCE_PRESETS[0].blueprint
    expect(appearance.withLowerGarment(base, 'kilt')).toBeNull()
    expect(
      appearance.parseAppearanceBlueprint({ ...base, coat: 'greatcloak', v: 2, lower: 'kilt' }),
    ).toBeNull()
    expect(
      appearance.parseAppearanceBlueprint({ ...base, coat: 'bolero', v: 2, lower: 'original' }),
    ).toBeNull()
    expect(
      appearance.parseAppearanceBlueprint({ ...base, coat: 'bolero', v: 1, lower: 'kilt' }),
    ).toBeNull()
  })
  it('serves the v2 atlas only through the exact versioned media path', async () => {
    const base = appearance.parseAppearanceBlueprint({
      ...appearance.APPEARANCE_PRESETS[0].blueprint,
      coat: 'bolero',
    })!
    const manifest = appearance.compileAppearanceManifest(
      appearance.withLowerGarment(base, 'divided')!,
    )
    const [version, blueprint] = manifest.id.split('/') as [string, string]
    const request = new Request(`https://example.test${manifest.atlas}`)
    const get = (v: string, id = blueprint) =>
      GET(request, { params: Promise.resolve({ version: v, blueprint: id, asset: 'atlas.svg' }) })
    const response = await get(version)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('immutable')
    expect(await response.text()).toBe(renderAppearanceAsset(manifest.blueprint, 'atlas'))
    expect((await get('1')).status).toBe(404)
    expect((await get('02')).status).toBe(404)
    expect((await get('2', blueprint.replace('.bolero.', '.greatcloak.'))).status).toBe(404)
  })
})

describe('independent sleeve cuffs', () => {
  const original = { ...appearance.APPEARANCE_PRESETS[0].blueprint, coat: 'doublet' } as const
  const url =
    '/api/media/appearance/3/slight.tan.braid.copper.doublet.open.split.lacing.pointed.linen.satchel.pine.original.flared/neutral.svg'

  it('loads a canonical v3 recipe while retaining the original trousers', () => {
    expect(appearance.appearanceManifestFromImageUrl(url)?.blueprint).toEqual({
      ...original,
      v: 3,
      lower: 'original',
      cuff: 'flared',
    })
  })

  it('adds and removes the cuff without resetting the separate lower garment', () => {
    const kilt = appearance.withLowerGarment(original, 'kilt')!
    const flared = appearance.withCuff(kilt, 'flared')!
    expect(flared).toEqual({ ...kilt, v: 3, cuff: 'flared' })
    expect(appearance.withCuff(flared, 'original')).toEqual(kilt)
    const cuffsOnly = appearance.withLowerGarment(flared, 'original')!
    expect(appearance.compileAppearanceManifest(cuffsOnly).portraits.neutral).toBe(url)
    expect(appearance.appearanceManifestFromImageUrl(url)?.blueprint).toEqual(cuffsOnly)
    expect(appearance.withCuff(cuffsOnly, 'original')).toEqual(original)
  })

  it('rejects hidden cuffs, unknown IDs and aliases for historical recipes', () => {
    expect(
      appearance.appearanceManifestFromImageUrl(url.replace('.doublet.', '.bolero.')),
    ).toBeNull()
    expect(
      appearance.appearanceManifestFromImageUrl(url.replace('.flared/', '.original/')),
    ).toBeNull()
    expect(
      appearance.appearanceManifestFromImageUrl(url.replace('.flared/', '.invented/')),
    ).toBeNull()
    expect(appearance.appearanceManifestFromImageUrl(url.replace('/3/', '/2/'))).toBeNull()
    expect(
      appearance.appearanceManifestFromImageUrl(url.replace('.original.', '.invented.')),
    ).toBeNull()
  })

  it('returns a complete immutable bundle with distinct atlas art for each cuff', async () => {
    const assets = [...appearance.APPEARANCE_EXPRESSIONS, 'icon', 'atlas'] as const
    const oldAtlases = [renderAppearanceAsset(original, 'atlas')]
    const atlasOutputs = new Set(oldAtlases)
    for (const cuff of [
      'folded',
      'flared',
      'braced',
      'wrapped',
      'laced',
      'laminated',
      'splitbell',
      'gauntlet',
      'scalloped',
    ] as const) {
      const blueprint = appearance.withCuff(original, cuff)!
      const manifest = appearance.compileAppearanceManifest(blueprint)
      const [version, id] = manifest.id.split('/') as [string, string]
      for (const asset of assets) {
        const filename = `${asset}.svg`
        const result = await GET(new Request(`https://example.test${url}`), {
          params: Promise.resolve({ version, blueprint: id, asset: filename }),
        })
        expect(result.status).toBe(200)
        expect(result.headers.get('Cache-Control')).toContain('immutable')
        const drawing = await result.text()
        expect(drawing).toMatch(/^<svg /)
        if (asset === 'atlas') atlasOutputs.add(drawing)
      }
    }
    expect(atlasOutputs.size).toBe(10)
  })

  it('keeps old wardrobe atlases and portraits at their previously served bytes', () => {
    const v2 = appearance.withLowerGarment(original, 'kilt')!
    expect(sha256(renderAppearanceAsset(original, 'atlas'))).toBe(
      '4d8f72f38f2b5396f80bf715490faf402a8b4fc3c457c1be3ee1aa6c0b2c639a',
    )
    expect(sha256(renderAppearanceAsset(v2, 'atlas'))).toBe(
      '38bbbbb95eff536385e64f68a62163a07424270f87eeaf1cf136e26e9251de05',
    )
    for (const blueprint of [original, v2]) {
      expect(sha256(renderAppearanceAsset(blueprint, 'neutral'))).toBe(
        '811b9f12102810f08e0ace419ca83c7e8a6b7854974bc7fc44cb6543971739e6',
      )
    }
  })
})

it('round-trips painted styles and independently colors clothing and accessories', async () => {
  const rendered = new Set<string>()
  const looks: PaintedLook[] = [
    ...Object.keys(PAINTED_CLOTHING).map((outerwear) => ({
      ...DEFAULT_PAINTED_LOOK,
      outerwear: outerwear as PaintedLook['outerwear'],
    })),
    { ...DEFAULT_PAINTED_LOOK, identity: 'guard', gear: 'mapcase', gearColor: 'crimson' },
    { ...DEFAULT_PAINTED_LOOK, identity: 'guard', gear: 'mapcase', gearColor: 'teal' },
    {
      ...DEFAULT_PAINTED_LOOK,
      identity: 'guard',
      clothColor: 'ember',
      gear: 'mapcase',
      gearColor: 'teal',
    },
    { ...DEFAULT_PAINTED_LOOK, identity: 'ranger', gear: 'potions' },
    { ...DEFAULT_PAINTED_LOOK, identity: 'elder', gear: 'bedroll' },
    { ...DEFAULT_PAINTED_LOOK, headwear: 'arcanist', headColor: 'cobalt' },
    { ...DEFAULT_PAINTED_LOOK, headwear: 'bandana' },
    { ...DEFAULT_PAINTED_LOOK, facewear: 'eyepatch' },
    { ...DEFAULT_PAINTED_LOOK, facewear: 'goggles', faceColor: 'amber' },
  ]
  for (const look of looks) {
    const blueprint = appearance.paintedAppearanceBlueprint(look)
    const manifest = appearance.compileAppearanceManifest(blueprint)
    expect(
      appearance.appearanceManifestFromImageUrl(manifest.portraits.neutral)?.blueprint,
    ).toEqual(blueprint)
    const response = await GET(new Request('https://aurevane.invalid'), {
      params: Promise.resolve({
        version: '4',
        blueprint: manifest.id.slice(2),
        asset: 'atlas.svg',
      }),
    })
    expect(response.ok).toBe(true)
    const atlas = await response.text()
    expect(atlas).toContain('id="painted-body"')
    expect(atlas).toContain('viewBox="384 0 128 176"')
    // Render only the initial idle cell instead of decoding off-screen action frames
    // for every recipe in this color and silhouette comparison.
    const cell = atlas.replace(
      'width="576" height="384" viewBox="0 0 576 384"',
      'width="48" height="64" viewBox="0 0 48 64"',
    )
    const { data: idle, info } = await sharp(Buffer.from(cell))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect([info.width, info.height]).toEqual([48, 64])
    expect(idle.filter((alpha, index) => index % 4 === 3 && alpha > 200).length).toBeGreaterThan(
      220,
    )
    rendered.add(createHash('sha256').update(idle).digest('hex'))
  }
  expect(rendered.size).toBe(looks.length)
  expect(
    appearance.appearanceBlueprintFromId(
      'scout.none.ember.none.natural.none.natural.none.natural',
      '4',
    ),
  ).toBeNull()
  expect(
    appearance.appearanceBlueprintFromId(
      'scout.compass.ocean.none.ember.none.natural.none.natural',
      '4',
    ),
  ).toBeNull()
  expect(
    appearance.parseAppearanceBlueprint({
      ...appearance.paintedAppearanceBlueprint(DEFAULT_PAINTED_LOOK),
      hair: 'curls',
    }),
  ).toBeNull()
})

it('paints all expressions and keeps an equipped head and face accessory on each walk frame', async () => {
  const base = appearance.paintedAppearanceBlueprint({
    ...DEFAULT_PAINTED_LOOK,
    identity: 'ranger',
    headwear: 'arcanist',
    headColor: 'pine',
  })
  const dressed = appearance.paintedAppearanceBlueprint({
    ...base,
    facewear: 'eyepatch',
    faceColor: 'charcoal',
  })
  const portraits = new Set<string>()
  for (const expression of appearance.APPEARANCE_EXPRESSIONS) {
    const portrait = await sharp(Buffer.from(renderAppearanceAsset(dressed, expression)))
      .png()
      .toBuffer()
    portraits.add(createHash('sha256').update(portrait).digest('hex'))
  }
  expect(portraits.size).toBe(5)
  const baselinePortrait = await sharp(Buffer.from(renderAppearanceAsset(base, 'neutral')))
    .png()
    .toBuffer()
  expect(portraits.has(createHash('sha256').update(baselinePortrait).digest('hex'))).toBe(false)

  const [dressedAtlas, baseAtlas] = await Promise.all(
    [dressed, base].map((blueprint) =>
      sharp(Buffer.from(renderAppearanceAsset(blueprint, 'atlas')))
        .png()
        .toBuffer(),
    ),
  )
  for (const facing of appearance.APPEARANCE_FACINGS) {
    const frames = new Set<string>()
    for (const frame of [0, 1, 2]) {
      const { column, row } = appearance.appearanceFrameIndex(facing, 'walk', frame)
      const bounds = { left: column * 48, top: row * 64, width: 48, height: 64 }
      const equipped = await sharp(dressedAtlas).extract(bounds).ensureAlpha().raw().toBuffer()
      const plain = await sharp(baseAtlas).extract(bounds).ensureAlpha().raw().toBuffer()
      expect(equipped.equals(plain), `${facing} walk ${frame}`).toBe(false)
      frames.add(createHash('sha256').update(equipped).digest('hex'))
    }
    expect(frames.size).toBe(3)
  }
})
