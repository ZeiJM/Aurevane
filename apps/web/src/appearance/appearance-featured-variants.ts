import { daryaCourierLook, paintedDaryaHairstyle } from './appearance-darya-look'
import { matchingPaintedStudy, paintedStudyForFace } from './appearance-painted-studies'
import type { PaintedPlayerLook } from './appearance-painted-wardrobe'

export const featuredVariantDyes = ['ember', 'glacier'] as const
type FeaturedDye = (typeof featuredVariantDyes)[number]

export function featuredVariantDye(look: PaintedPlayerLook): FeaturedDye | undefined {
  const palette = look.outerwear === 'none' ? look.faceColor : look.clothColor
  return featuredVariantDyes.find((dye) => dye === palette)
}

export function hasOriginalFeaturedArt(look: PaintedPlayerLook) {
  return Boolean(matchingPaintedStudy(look) ?? paintedDaryaHairstyle(look))
}

export function featuredStudy(look: PaintedPlayerLook) {
  const original = paintedStudyForFace(look.faceId)
  return matchingPaintedStudy(
    original && featuredVariantDye(look)
      ? {
          ...look,
          clothColor: original.look.clothColor,
          faceColor: look.outerwear === 'none' ? original.look.faceColor : look.faceColor,
        }
      : look,
  )
}

export function featuredDaryaHairstyle(look: PaintedPlayerLook) {
  return paintedDaryaHairstyle(
    featuredVariantDye(look) ? { ...look, clothColor: daryaCourierLook.clothColor } : look,
  )
}

// Apply the palette to the painting only. The selected setting has its own lighting.
export function featuredPaintFilter(id: string, dye: FeaturedDye) {
  const gains = dye === 'ember' ? [1.08, 1.01, 0.93] : [0.94, 1.025, 1.09]
  return `<filter id="${id}" color-interpolation-filters="sRGB"><feComponentTransfer>
    <feFuncR type="linear" slope="${gains[0]}"/>
    <feFuncG type="linear" slope="${gains[1]}"/>
    <feFuncB type="linear" slope="${gains[2]}"/>
    </feComponentTransfer></filter>`
}
