import { PAINTED_ACCESSORY_LAYERS } from './appearance-painted-catalog.generated'
import { paintedDyeFilter } from './appearance-painted-equipment'
import { PAINTED_PORTRAIT_GARMENTS } from './appearance-painted-portrait-garments.generated'
import { WARDROBE_GEAR_LAYERS } from './appearance-painted-wardrobe.generated'
import {
  WARDROBE_DYES,
  WARDROBE_FRAMES,
  type PaintedPlayerLook,
} from './appearance-painted-wardrobe'

const accessories = { ...PAINTED_ACCESSORY_LAYERS, ...WARDROBE_GEAR_LAYERS }
type Dye = PaintedPlayerLook['clothColor']
type Fit = Readonly<{ x: number; y: number; width: number; neck: string; braid?: string }>

// Each neck cut follows the subject's original portrait rather than leaving the
// shoulders and gear from another outfit behind the new garment.
const fits: Record<PaintedPlayerLook['identity'], Fit> = {
  pinescout: {
    x: 142,
    y: 136,
    width: 249,
    neck: 'M0 0H256V132L190 147 179 161 179 256H111L115 159 77 169 0 142Z',
    braid:
      'M54 126Q78 126 93 147L111 175 117 191 121 207 136 221 143 251 138 256H110L102 237 111 213Q102 199 96 184L83 169 63 166 59 153Z',
  },
  scout: {
    x: 149,
    y: 162,
    width: 230,
    neck: 'M0 0H256V147L202 151 179 178 181 256H118L132 174 93 177 0 159Z',
  },
  ranger: {
    x: 145,
    y: 145,
    width: 228,
    neck: 'M0 0H256V143L195 145 176 151 173 256H115L120 164 74 173 0 155Z',
    braid:
      'M69 125Q85 125 97 142L110 166 122 181 128 201Q130 224 118 238Q112 239 108 233L95 218 96 198 83 183 79 169 66 156Z',
  },
  guard: {
    x: 153,
    y: 145,
    width: 247,
    neck: 'M0 0H256V143L192 144 183 158 187 256H111L111 166 104 149 96 137 71 130 0 127Z',
  },
  elder: {
    x: 151,
    y: 136,
    width: 231,
    neck: 'M0 0H256V132L198 135 180 149 181 256H115L116 161 98 151 0 149Z',
  },
}

function clothPigment(dye: Dye) {
  const pigment = WARDROBE_DYES[dye].rgb
  if (!pigment) return ''
  const matrix = pigment.map((channel) => {
    const gain = channel / 117
    return [0.2126 * gain, 0.7152 * gain, 0.0722 * gain, 0, 0.013].join(' ')
  })
  // Let the warm undertone, embroidery and metal fittings show through the dye.
  return `<filter id="portrait-cloth-dye" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" values="${matrix.join(' ')} 0 0 0 1 0" result="pigment"/>
    <feComposite in="pigment" in2="SourceGraphic" operator="arithmetic" k2=".78" k3=".22"/>
  </filter>`
}

export function paintedPortraitWardrobe(
  look: PaintedPlayerLook,
  subject: string,
  independentHead = false,
) {
  const { x, y, width, neck, braid } = independentHead
    ? { ...fits.guard, x: 145, y: 157, width: 246, braid: undefined }
    : fits[look.identity]
  const { clothColor, gear, gearColor } = look
  const coat = independentHead && look.outerwear === 'none' ? 'compass' : look.outerwear
  const scale = WARDROBE_FRAMES[look.bodyFrame].torsoScale
  const frame = 1 + (scale - 1) * 0.66
  const fit = (art: string) =>
    frame === 1
      ? art
      : `<g transform="translate(${x} 0) scale(${frame} 1) translate(${-x} 0)">${art}</g>`
  const tail = braid ? `<g clip-path="url(#portrait-braid)">${subject}</g>` : ''
  let definition = ''
  let outfit = subject

  if (coat !== 'none') {
    const garment = PAINTED_PORTRAIT_GARMENTS[coat]
    const filter = clothColor === 'natural' ? '' : ' filter="url(#portrait-cloth-dye)"'
    const tailored = `<image href="${garment.uri}" x="${x - width * 0.58}" y="${y}" width="${width}" height="${(width * garment.height) / 278}"${filter}/>`
    definition =
      `<clipPath id="portrait-neck"><path d="${neck}"/></clipPath>` +
      (braid ? `<clipPath id="portrait-braid"><path d="${braid}"/></clipPath>` : '') +
      clothPigment(clothColor)
    outfit = independentHead
      ? subject + fit(tailored)
      : `<g clip-path="url(#portrait-neck)">${subject}</g>${fit(tailored)}${tail}`
  } else if (frame !== 1) {
    definition = `<clipPath id="portrait-shoulders"><path d="M0 ${y + 40}Q128 ${y + 10} 256 ${y + 42}V256H0Z"/></clipPath>
      <clipPath id="portrait-upper"><path d="M0 0H256V${y + 42}Q128 ${y + 10} 0 ${y + 40}Z"/></clipPath>`
    outfit = `<g clip-path="url(#portrait-upper)">${subject}</g>
      <g clip-path="url(#portrait-shoulders)">${fit(subject)}</g>`
  }

  // All current gear pieces are waist-mounted and sit below the framed portrait.
  if (gear !== 'none' && !look.faceId) {
    const filter = gearColor === 'natural' ? '' : ' filter="url(#portrait-gear-dye)"'
    definition += paintedDyeFilter('portrait-gear-dye', gearColor)
    outfit +=
      fit(`<svg x="${x + width * 0.09}" y="${y + 77}" width="${width * 0.34}" height="60" viewBox="26 79 76 57" preserveAspectRatio="none" overflow="hidden">
      <image href="${accessories[gear]}" width="512" height="176"${filter}/>
    </svg>`)
  }

  return { definitions: definition, art: outfit }
}
