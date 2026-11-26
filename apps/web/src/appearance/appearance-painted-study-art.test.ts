import { GET } from '@/app/api/media/appearance/[version]/[blueprint]/[asset]/route'
import { describe, expect, it } from 'vitest'
import { PAINTED_STUDIES, matchingPaintedStudy } from './appearance-painted-studies'
import {
  APPEARANCE_EXPRESSIONS,
  appearanceManifestFromImageUrl,
  compileAppearanceManifest,
  paintedPlayerAppearanceBlueprint,
} from './appearance-manifest'
import { renderAppearanceAsset } from './appearance-svg'

describe.each(Object.values(PAINTED_STUDIES))('$key painted character study', (study) => {
  it('uses the five painted expressions and registered movement from the saved recipe', () => {
    const blueprint = paintedPlayerAppearanceBlueprint({ ...study.look, backdrop: 'parchment' })
    const manifest = compileAppearanceManifest(blueprint)
    expect(appearanceManifestFromImageUrl(manifest.neutralUrl)?.blueprint).toEqual(blueprint)
    expect(matchingPaintedStudy(blueprint)).toBe(study.key)
    const portraits = APPEARANCE_EXPRESSIONS.map((mood) =>
      renderAppearanceAsset(blueprint, mood, true),
    )
    expect(new Set(portraits).size).toBe(5)
    expect(portraits.some((svg) => svg.includes('feDisplacementMap'))).toBe(false)
    const motion = renderAppearanceAsset(blueprint, 'motion-v2', true)
    expect(motion).toContain('width="1536" height="384"')
    expect(motion).toContain('href="#study-south-left"')
    expect(motion).toContain('href="#study-east-passing"')
    expect(motion).toContain('href="#study-north-right"')
  })

  it('displays custom selections through the shared renderer', () => {
    const blueprint = paintedPlayerAppearanceBlueprint({ ...study.look, hairDye: 'charcoal' })
    expect(matchingPaintedStudy(blueprint)).toBeUndefined()
    expect(renderAppearanceAsset(blueprint, 'neutral', true)).toContain('painted-hair')
  })
})

it('keeps Asta’s authored cape and poses when changing the cloth dye', () => {
  const original = paintedPlayerAppearanceBlueprint(PAINTED_STUDIES.f32.look)
  const dyed = paintedPlayerAppearanceBlueprint({ ...original, clothColor: 'denim' })
  expect(matchingPaintedStudy(dyed)).toBe('asta')
  expect(
    appearanceManifestFromImageUrl(compileAppearanceManifest(dyed).neutralUrl)?.blueprint,
  ).toEqual(dyed)
  for (const mood of APPEARANCE_EXPRESSIONS) {
    expect(renderAppearanceAsset(original, mood, true)).not.toContain('study-fabric-dye')
    const portrait = renderAppearanceAsset(dyed, mood, true)
    expect(portrait).toContain('mask="url(#study-portrait-fabric)"')
    expect(portrait).toContain('filter="url(#study-fabric-dye)"')
  }
  const atlas = renderAppearanceAsset(dyed, 'motion-v2', true)
  expect(atlas).toContain('mask="url(#study-east-passing-fabric)"')
  expect(atlas).toContain('mask="url(#study-north-cast-fabric)"')
})

it('serves approved artwork at the canonical URL saved by the conversion', async () => {
  const blueprint = paintedPlayerAppearanceBlueprint(PAINTED_STUDIES.f32.look)
  const manifest = compileAppearanceManifest(blueprint)
  const response = await GET(new Request('https://aurevane.test' + manifest.neutralUrl), {
    params: Promise.resolve({
      version: '6',
      blueprint: manifest.id.slice(2),
      asset: 'neutral.svg',
    }),
  })
  expect(await response.text()).toBe(renderAppearanceAsset(blueprint, 'neutral', true))
})
