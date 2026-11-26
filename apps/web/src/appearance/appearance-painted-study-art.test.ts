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
    const blueprint = paintedPlayerAppearanceBlueprint({ ...study.look, hairDye: 'silver' })
    expect(matchingPaintedStudy(blueprint)).toBeUndefined()
    expect(renderAppearanceAsset(blueprint, 'neutral', true)).toContain('painted-hair')
  })
})
