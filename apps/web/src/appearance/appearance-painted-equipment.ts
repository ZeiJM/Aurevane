import fittedArt from './appearance-fitted-equipment.json'
import classicFit from './appearance-classic-fit.json'
import type { FaceFit } from './appearance-face-paint'
import type { AppearanceExpression, AppearanceFacing } from './appearance-manifest'
import { type PaintedLook } from './appearance-painted-catalog'
import { PAINTED_PORTRAIT_IRISES } from './appearance-painted-features'
import {
  WARDROBE_DYES,
  type PaintedPlayerLook,
  type PaintedWardrobeLook,
} from './appearance-painted-wardrobe'
import { PAINTED_HEAD_PARTS } from './appearance-painted-headwear.generated'
import { WARDROBE_HEAD_LAYERS } from './appearance-painted-wardrobe.generated'

type Dye = PaintedWardrobeLook['clothColor']
const equipment = { ...PAINTED_HEAD_PARTS, ...WARDROBE_HEAD_LAYERS }
type Equipment = keyof typeof equipment
type HeadAnchor = readonly [x: number, scalp: number, width: number]
type PortraitAnchor = readonly [x: number, scalp: number, width: number, eyeX: number, eyeY: number]
type EquippedLook = PaintedWardrobeLook | PaintedLook | PaintedPlayerLook

const fieldHeads = {
  pinescout: { south: [63, 16, 27], east: [63, 16, 27], north: [64, 16, 27], west: [64, 16, 26] },
  scout: { south: [61, 21, 37], east: [65, 21, 37], north: [65, 22, 36], west: [64, 20, 37] },
  ranger: { south: [62, 17, 27], east: [64, 15, 28], north: [64, 16, 25], west: [64, 19, 27] },
  guard: { south: [63, 13, 24], east: [66, 15, 25], north: [64, 14, 23], west: [62, 15, 24] },
  elder: { south: [63, 18, 31], east: [63, 18, 30], north: [64, 17, 27], west: [65, 17, 29] },
} as const satisfies Record<PaintedPlayerLook['identity'], Record<AppearanceFacing, HeadAnchor>>

export function fieldFaceAnchor(identity: PaintedPlayerLook['identity'], facing: AppearanceFacing) {
  const [x, y, w] = fieldHeads[identity][facing]
  return { x: facing === 'south' ? 64 : x, y, w }
}

const portraitHeads = {
  pinescout: [131, 9, 157, 150, 76],
  scout: [133, 20, 166, 158, 119],
  ranger: [128, 12, 149, 153, 86],
  guard: [132, 16, 133, 157, 81],
  elder: [134, 23, 159, 155, 97],
} as const satisfies Record<PaintedPlayerLook['identity'], PortraitAnchor>

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
  look: EquippedLook,
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

export function paintedEquipmentDyes(look: EquippedLook) {
  return (
    paintedDyeFilter('dye-headwear', look.headColor) +
    paintedDyeFilter('dye-facewear', look.faceColor)
  )
}

export function paintedFieldEquipment(
  look: EquippedLook,
  facing: AppearanceFacing,
  frontal = false,
) {
  const front = frontal && facing === 'south'
  const [oldX, scalp, width] = fieldHeads[look.identity][facing]
  const x = front ? 64 : oldX
  const lowerFace = look.facewear === 'veil' || look.facewear === 'mask'
  const patch = 'backdrop' in look && look.facewear === 'eyepatch'
  const facewear = patch
    ? equipmentImage(
        'eyepatch',
        facing,
        'dye-facewear',
        [
          x - width * (facing === 'east' ? 0.37 : 0.44),
          scalp + width * (facing === 'south' ? 0.16 : 0.22),
          width * 0.93,
          width * (facing === 'south' || facing === 'east' ? 0.38 : 0.19),
        ],
        look.faceColor,
      )
    : look.facewear === 'none'
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

export function fittedPortraitHat(
  look: PaintedPlayerLook,
  expression: AppearanceExpression,
  registered?: FaceFit,
) {
  if (!look.faceId || (look.headwear !== 'arcanist' && look.headwear !== 'furcap')) return null
  const fit = registered ?? classicFit[look.identity][expression]
  const width = Math.max(
    registered?.width ?? portraitHeads[look.identity][2],
    (fit.temples[1]![0]! - fit.temples[0]![0]!) * 1.55,
  )
  const cap = look.headwear === 'furcap'
  const w = width * (cap ? 1.08 : 1.35),
    h = w * (cap ? 0.53 : 0.67)
  const bottom = fit.eyes[0]![1]! - width * 0.09
  const center = (fit.temples[1]![0]! + fit.temples[0]![0]!) / 2 - width * 0.1
  return { left: center - w / 2, top: bottom - h, w, h, bottom }
}

function fittedPortraitEquipment(
  look: PaintedPlayerLook,
  expression: AppearanceExpression,
  registered?: FaceFit,
) {
  const fit = registered ?? classicFit[look.identity][expression]
  // Runtime face plates and classic portraits share measured expression-specific anchors.
  const [near, far] = fit.eyes as readonly (readonly number[])[]
  const [lx, ly] = near!,
    [rx, ry] = far!
  const [temple, other] = fit.temples
  const x = temple![0]!,
    end = other![0]!,
    width = Math.max(60, end - x)
  const span = rx! - lx!
  const tilt = (Math.atan2(ry! - ly!, span) * 180) / Math.PI
  const item = (
    style: keyof typeof fittedArt,
    left: number,
    top: number,
    w: number,
    h: number,
    dye: Dye,
    id: string,
  ) =>
    `<image href="${fittedArt[style]}" x="${left}" y="${top}" width="${w}" height="${h}" preserveAspectRatio="none"${dye === 'natural' ? '' : ` filter="url(#dye-${id})"`}/>`
  let hat = ''
  if (look.headwear === 'furcap' || look.headwear === 'arcanist') {
    const box = fittedPortraitHat(look, expression, registered)!
    hat = item(look.headwear, box.left, box.top, box.w, box.h, look.headColor, 'headwear')
  } else {
    const scalp = registered?.top ?? portraitHeads[look.identity][1]
    hat = headwearImage(look, 'east', [(x + end) / 2 - width * 0.08, scalp, width * 1.5])
  }
  const type = look.facewear
  if (type === 'none') return hat
  let face: string
  if (type === 'goggles') {
    const w = span / 0.4,
      h = w * 0.39
    face = item(type, lx! - w * 0.47, ly! - h * 0.52, w, h, look.faceColor, 'facewear')
  } else if (type === 'eyepatch') {
    const w = width * 1.14,
      h = span * 0.86
    face = item(type, lx! - w * 0.53, ly! - h * 0.53, w, h, look.faceColor, 'facewear')
  } else {
    const left = x - 2,
      right = other![0]! + width * 0.1,
      top = fit.nose[1]! - width * 0.094
    const h = fit.chin[1]! - top + 2
    face = item(type, left, top, right - left, h, look.faceColor, 'facewear')
  }
  return (
    hat +
    (type === 'goggles' || type === 'eyepatch'
      ? `<g transform="rotate(${tilt} ${lx} ${ly})">${face}</g>`
      : face)
  )
}

export function paintedPlayerPortraitEquipment(
  look: PaintedPlayerLook,
  expression: AppearanceExpression,
  fit?: FaceFit,
) {
  if (look.faceId) return fittedPortraitEquipment(look, expression, fit)
  const [x, scalp, width] = portraitHeads[look.identity]
  const [nearEye, farEye] = PAINTED_PORTRAIT_IRISES[look.identity][expression]
  const span = farEye[0] - nearEye[0]
  const tilt = Math.atan2(farEye[1] - nearEye[1], span) * (180 / Math.PI)
  const { facewear, faceColor, headwear, headColor } = look
  let head = ''
  if (headwear !== 'none') {
    const brim = headwear === 'arcanist'
    const fur = headwear === 'furcap'
    const circlet = headwear === 'circlet'
    const headWidth = width * (brim ? 1.23 : fur ? 0.88 : circlet ? 0.75 : 0.96)
    const headHeight = width * (brim ? 0.826 : fur ? 0.74 : circlet ? 0.18 : 0.41)
    const headBottom = Math.min(
      scalp + width * (circlet ? 0.34 : 0.49),
      nearEye[1] - (circlet ? 13 : 17),
    )
    head = equipmentImage(
      headwear,
      circlet ? 'south' : 'east',
      'dye-headwear',
      [x - headWidth / 2, headBottom - headHeight, headWidth, headHeight],
      headColor,
    )
    if (circlet) {
      const left = x - headWidth / 2
      const decoratedFront = headBottom - headHeight * 0.65
      head = `<defs><clipPath id="portrait-circlet"><rect x="${left}" y="${decoratedFront}" width="${headWidth}" height="${headHeight}"/></clipPath></defs>
        <g clip-path="url(#portrait-circlet)">${head}</g>`
    }
  }
  if (facewear === 'none') return head

  let bounds: readonly [number, number, number, number]
  if (facewear === 'eyepatch') {
    const [eyeX, eyeY] = nearEye
    const patchWidth = span * 1.8
    const patchHeight = span * 0.87
    const patchX = eyeX - patchWidth * 0.31
    const patchY = eyeY - patchHeight * 0.66
    bounds = [patchX, patchY, patchWidth, patchHeight]
    const strap = `M${eyeX - span * 1.1} ${eyeY - 9}Q${eyeX + span * 0.16} ${eyeY - 17} ${farEye[0] + span * 0.59} ${farEye[1] - 14}`
    const dye = faceColor === 'natural' ? '' : ' filter="url(#dye-facewear)"'
    return (
      head +
      `<defs><clipPath id="portrait-patch-plate"><rect x="${patchX + 2}" y="${eyeY - patchHeight * 0.43}" width="${patchWidth * 0.66}" height="${patchHeight}"/></clipPath></defs>
      <g fill="none"${dye}><path d="${strap}" stroke="#362821" stroke-width="4" stroke-linecap="round"/>
      <path d="${strap}" stroke="#976b49" stroke-width="1" stroke-linecap="round" opacity=".56"/></g>
      <g clip-path="url(#portrait-patch-plate)">${equipmentImage(facewear, 'south', 'dye-facewear', bounds, faceColor)}</g>`
    )
  } else if (facewear === 'goggles') {
    const goggleWidth = span * 2.16
    const goggleHeight = span * 0.93
    bounds = [
      nearEye[0] - goggleWidth * 0.26,
      nearEye[1] - goggleHeight * 0.49,
      goggleWidth,
      goggleHeight,
    ]
  } else {
    const maskWidth = width * (facewear === 'veil' ? 0.47 : 0.43)
    const maskHeight = width * (facewear === 'veil' ? 0.31 : 0.28)
    bounds = [nearEye[0] - maskWidth * 0.34, nearEye[1] + width * 0.15, maskWidth, maskHeight]
  }
  return (
    head +
    `<g transform="rotate(${tilt} ${nearEye[0]} ${nearEye[1]})">${equipmentImage(facewear, 'south', 'dye-facewear', bounds, faceColor)}</g>`
  )
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
