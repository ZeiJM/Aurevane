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
