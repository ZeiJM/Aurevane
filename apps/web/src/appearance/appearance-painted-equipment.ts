import type { AppearanceFacing } from './appearance-manifest'
import { PAINTED_COLORS, type PaintedLook } from './appearance-painted-catalog'
import { PAINTED_HEAD_PARTS } from './appearance-painted-headwear.generated'

type Dye = PaintedLook['clothColor']
type Equipment = keyof typeof PAINTED_HEAD_PARTS
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
  const pigment = color ? PAINTED_COLORS[color].rgb : null
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
  return `<image href="${PAINTED_HEAD_PARTS[style][facing]}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"${filter}/>`
}

function headwearImage(look: PaintedLook, facing: AppearanceFacing, [x, scalp, width]: HeadAnchor) {
  if (look.headwear === 'none') return ''
  const wizard = look.headwear === 'arcanist'
  const artWidth = width * (wizard ? 1.47 : 1.13)
  const artHeight = width * (wizard ? 1.01 : 0.56)
  const top = scalp + width * (wizard ? 0.52 : -0.02) - (wizard ? artHeight : 0)
  return equipmentImage(
    look.headwear,
    facing,
    'dye-headwear',
    [x - artWidth / 2, top, artWidth, artHeight],
    look.headColor,
  )
}

export function paintedEquipmentDyes(look: PaintedLook) {
  return (
    paintedDyeFilter('dye-headwear', look.headColor) +
    paintedDyeFilter('dye-facewear', look.faceColor)
  )
}

export function paintedFieldEquipment(look: PaintedLook, facing: AppearanceFacing) {
  const [x, scalp, width] = fieldHeads[look.identity][facing]
  const facewear =
    look.facewear === 'none'
      ? ''
      : equipmentImage(
          look.facewear,
          facing,
          'dye-facewear',
          [
            x - width * (facing === 'west' ? 0.59 : 0.39),
            scalp + width * (look.facewear === 'eyepatch' ? 0.36 : 0.32),
            width * (facing === 'west' ? 0.92 : 0.84),
            width * (facing === 'west' && look.facewear === 'eyepatch' ? 0.12 : 0.27),
          ],
          look.faceColor,
        )
  return `<g transform="translate(3.52 7.44) scale(.32)">${headwearImage(look, facing, [x, scalp, width])}${facewear}</g>`
}

export function paintedPortraitEquipment(look: PaintedLook) {
  const [x, scalp, width, eyeX, eyeY] = portraitHeads[look.identity]
  const facewear =
    look.facewear === 'none'
      ? ''
      : equipmentImage(
          look.facewear,
          look.facewear === 'eyepatch' ? 'south' : 'east',
          'dye-facewear',
          [
            eyeX - width * (look.facewear === 'eyepatch' ? 0.23 : 0.53),
            eyeY - width * (look.facewear === 'eyepatch' ? 0.18 : 0.14),
            width * 0.62,
            width * (look.facewear === 'eyepatch' ? 0.3 : 0.26),
          ],
          look.faceColor,
        )
  return headwearImage(look, 'east', [x, scalp, width]) + facewear
}
