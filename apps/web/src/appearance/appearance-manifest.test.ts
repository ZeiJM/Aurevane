import { describe, expect, it } from 'vitest'

import * as appearance from './appearance-manifest'
import { renderAppearanceAsset } from './appearance-svg'

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
})
