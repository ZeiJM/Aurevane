import type { AppearanceFacing } from './appearance-manifest'
import { type PaintedLook } from './appearance-painted-catalog'
import { WARDROBE_DYES, type PaintedWardrobeLook } from './appearance-painted-wardrobe'
import { PAINTED_HEAD_PARTS } from './appearance-painted-headwear.generated'
import { WARDROBE_HEAD_LAYERS } from './appearance-painted-wardrobe.generated'

type Dye = PaintedWardrobeLook['clothColor']
const equipment = { ...PAINTED_HEAD_PARTS, ...WARDROBE_HEAD_LAYERS }
type Equipment = keyof typeof equipment
type HeadAnchor = readonly [x: number, scalp: number, width: number]
type PortraitAnchor = readonly [x: number, scalp: number, width: number, eyeX: number, eyeY: number]

const fieldHeads = {
  scout: { south: [61, 21, 37], east: [65, 21, 37], north: [65, 22, 36], west: [64, 20, 37] },
  ranger: { south: [62, 17, 27], east: [64, 15, 28], north: [64, 16, 25], west: [64, 19, 27] },
  guard: { south: [63, 13, 24], east: [66, 15, 25], north: [64, 14, 23], west: [62, 15, 24] },
  elder: { south: [63, 18, 31], east: [63, 18, 30], north: [64, 17, 27], west: [65, 17, 29] },
} as const satisfies Record<PaintedLook['identity'], Record<AppearanceFacing, HeadAnchor>>

const portraitHeads = {
  scout: [133, 20, 166, 158, 119],
  ranger: [128, 12, 149, 153, 86],
  guard: [132, 16, 133, 157, 81],
  elder: [134, 23, 159, 155, 97],
} as const satisfies Record<PaintedLook['identity'], PortraitAnchor>

export function paintedDyeFilter(id: string, color?: Dye) {
  const pigment = color ? WARDROBE_DYES[color].rgb : null
  if (!pigment) return ''
  const matrix = pigment
    .map((channel) => {
      const gain = channel / 149
      return [0.2126 * gain, 0.7152 * gain, 0.0722 * gain, 0, 0.028].join(' ')
    })
    .join(' ')
  return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${matrix} 0 0 0 1 0"/></filter>`
}

function equipmentImage(
  style: Equipment,
  facing: AppearanceFacing,
  id: string,
  [x, y, width, height]: readonly [number, number, number, number],
  dye: Dye,
) {
  const filter = dye === 'natural' ? '' : ` filter="url(#${id})"`
  return `<image href="${equipment[style][facing]}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"${filter}/>`
}

function headwearImage(
  look: PaintedWardrobeLook | PaintedLook,
  facing: AppearanceFacing,
  [x, scalp, width]: HeadAnchor,
) {
  if (look.headwear === 'none') return ''
  const wizard = look.headwear === 'arcanist'
  const cap = look.headwear === 'furcap'
  const circlet = look.headwear === 'circlet'
  const artWidth = width * (wizard ? 1.47 : cap ? 1.16 : circlet ? 0.92 : 1.13)
  const artHeight = width * (wizard ? 1.01 : cap ? 1.02 : circlet ? 0.24 : 0.56)
  const top =
    scalp +
    width * (wizard ? 0.52 : cap ? 0.65 : circlet ? 0.28 : -0.02) -
    (wizard || cap ? artHeight : 0)
  return equipmentImage(
    look.headwear,
    facing,
    'dye-headwear',
    [x - artWidth / 2, top, artWidth, artHeight],
    look.headColor,
  )
}

export function paintedEquipmentDyes(look: PaintedWardrobeLook | PaintedLook) {
  return (
    paintedDyeFilter('dye-headwear', look.headColor) +
    paintedDyeFilter('dye-facewear', look.faceColor)
  )
}

export function paintedFieldEquipment(
  look: PaintedWardrobeLook | PaintedLook,
  facing: AppearanceFacing,
) {
  const [x, scalp, width] = fieldHeads[look.identity][facing]
  const lowerFace = look.facewear === 'veil' || look.facewear === 'mask'
  const facewear =
    look.facewear === 'none'
      ? ''
      : equipmentImage(
          look.facewear,
          facing,
          'dye-facewear',
          [
            x - width * (lowerFace ? 0.48 : facing === 'west' ? 0.59 : 0.39),
            scalp + width * (lowerFace ? 0.64 : look.facewear === 'eyepatch' ? 0.36 : 0.32),
            width * (lowerFace ? 0.94 : facing === 'west' ? 0.92 : 0.84),
            width *
              (lowerFace ? 0.52 : facing === 'west' && look.facewear === 'eyepatch' ? 0.12 : 0.27),
          ],
          look.faceColor,
        )
  return `<g transform="translate(3.52 7.44) scale(.32)">${headwearImage(look, facing, [x, scalp, width])}${facewear}</g>`
}

export function paintedPortraitEquipment(look: PaintedWardrobeLook | PaintedLook) {
  const [x, scalp, width, eyeX, eyeY] = portraitHeads[look.identity]
  const lowerFace = look.facewear === 'veil' || look.facewear === 'mask'
  const facewear =
    look.facewear === 'none'
      ? ''
      : equipmentImage(
          look.facewear,
          look.facewear === 'eyepatch' || lowerFace ? 'south' : 'east',
          'dye-facewear',
          [
            eyeX - width * (lowerFace ? 0.42 : look.facewear === 'eyepatch' ? 0.23 : 0.53),
            eyeY + width * (lowerFace ? 0.13 : look.facewear === 'eyepatch' ? -0.18 : -0.14),
            width * (lowerFace ? 0.53 : 0.62),
            width * (lowerFace ? 0.35 : look.facewear === 'eyepatch' ? 0.3 : 0.26),
          ],
          look.faceColor,
        )
  return headwearImage(look, 'east', [x, scalp, width]) + facewear
}
