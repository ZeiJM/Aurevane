import { describe, expect, it } from 'vitest'
import {
  daryaCourierBlueprint,
  daryaCourierLook,
  paintedDaryaHairstyle,
} from './appearance-darya-look'
import {
  APPEARANCE_EXPRESSIONS,
  appearanceManifestFromImageUrl,
  compileAppearanceManifest,
  paintedPlayerAppearanceBlueprint,
} from './appearance-manifest'
import { renderAppearanceAsset } from './appearance-svg'

describe('Darya’s courier artwork', () => {
  it('uses ordinary saved looks for both hairstyles and retains the selected background', () => {
    const coils = daryaCourierBlueprint()
    const alternate = paintedPlayerAppearanceBlueprint({
      ...daryaCourierLook,
      hairstyle: 'lowpony',
      backdrop: 'silverlake',
    })
    expect(paintedDaryaHairstyle(coils)).toBe('coils')
    expect(paintedDaryaHairstyle(alternate)).toBe('lowpony')
    for (const look of [coils, alternate]) {
      const manifest = compileAppearanceManifest(look)
      expect(appearanceManifestFromImageUrl(manifest.neutralUrl)?.blueprint).toEqual(look)
      const expressions = APPEARANCE_EXPRESSIONS.map((mood) =>
        renderAppearanceAsset(look, mood, true),
      )
      expect(new Set(expressions).size).toBe(5)
      expect(expressions.every((svg) => !svg.includes('feDisplacementMap'))).toBe(true)
      expect(renderAppearanceAsset(look, 'icon', true)).toContain('viewBox="56 28 144 144"')
    }
    expect(renderAppearanceAsset(coils, 'neutral', true)).not.toBe(
      renderAppearanceAsset(alternate, 'neutral', true),
    )
  })

  it('honors edits that require the standard customizable layers', () => {
    for (const edit of [
      { hairDye: 'silver' },
      { bodyFrame: 'strong' },
      { scar: 'cross' },
      { headwear: 'goldwingtricorn' },
    ] as const) {
      const look = paintedPlayerAppearanceBlueprint({ ...daryaCourierLook, ...edit })
      expect(paintedDaryaHairstyle(look)).toBeUndefined()
      expect(renderAppearanceAsset(look, 'neutral', true)).toContain('painted-neck-fit')
      expect(renderAppearanceAsset(look, 'motion-v2', true)).not.toContain('darya-south-idle')
    }
  })

  it('keeps the existing atlas dimensions and uses painted walk and cast poses', () => {
    const look = daryaCourierBlueprint()
    const svg = renderAppearanceAsset(look, 'motion-v2', true)
    expect(svg).toContain('width="1536" height="384"')
    expect(svg).toContain('href="#darya-north-passing"')
    expect(svg).toContain('href="#darya-south-left"')
    expect(svg).toContain('href="#darya-south-right"')
    expect(svg).toContain('href="#darya-east-cast"')
    expect(svg).toContain('class="darya-compass-light"')
    expect(svg).toContain('translate(48 0) scale(-1 1)')
    expect(renderAppearanceAsset(look, 'atlas', true)).toContain('width="576" height="384"')
  })
})
