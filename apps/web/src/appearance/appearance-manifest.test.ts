import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import * as appearance from './appearance-manifest'
import { renderAppearanceAsset } from './appearance-svg'
import { GET } from '@/app/api/media/appearance/[version]/[blueprint]/[asset]/route'

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex')

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
