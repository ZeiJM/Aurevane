import {
  APPEARANCE_FACINGS,
  type AppearanceExpression,
  type AppearanceFacing,
} from './appearance-manifest'
import {
  WARDROBE_EYE_COLORS,
  WARDROBE_HAIR_COLORS,
  type PaintedWardrobeLook,
} from './appearance-painted-wardrobe'

type Identity = PaintedWardrobeLook['identity']
type Point = readonly [x: number, y: number]
type Iris = readonly [x: number, y: number, radius: number]

// Scalp and iris regions follow the four original painted models. The portrait
// irises move independently in each expression, while field crops use 128×176.
const portraitScalps = {
  scout:
    'M34 117L37 52 79 17 139 10 187 26 204 62 204 107 182 111Q183 88 170 75T150 82Q143 94 133 102L120 104 111 116 110 135 101 149 78 157 52 148Z',
  ranger:
    'M42 92L50 32 83 13 139 8 182 24 203 61 203 104 191 107 185 81 174 63 160 49 151 52 136 65 123 87 104 96 95 115 98 136 106 153 111 168 123 191 116 245 84 231 71 196 64 164 52 147 38 126Z',
  guard:
    'M59 99L60 58 75 26 106 12 145 10 179 24 198 49 192 64Q172 54 152 52L132 54 123 59 115 71 111 86 105 96 96 106 75 112Z',
  elder:
    'M38 106L43 49 74 20 121 13 161 17 195 39 209 83 196 103 188 100Q185 71 170 53Q162 45 157 48Q152 66 138 73L125 78 117 89 111 103 108 117 99 130 99 147 88 165 52 162 38 142Z',
} as const

const fieldScalps = {
  scout: [
    'M41 45V16H79V38L73 42 70 34 66 32 56 39 56 48 49 48Z',
    'M41 49V16H84V35L77 40 73 34 66 39 61 46 54 49Z',
    'M42 53V16H86V53Z',
    'M43 37V16H87V46L72 51 62 45 56 39 54 33 50 35 50 40Z',
  ],
  ranger: [
    'M44 55V13H77V30L71 29 67 26 63 32 57 38 59 47 64 54 61 57Z',
    'M46 54V12H79V29L74 27 72 25 68 29 63 35 65 43 71 52 67 58Z',
    'M48 55V13H79V42L70 49 68 57H60L58 49Z',
    'M48 30V13H79V38L76 42 74 54 68 54 67 42 62 37 61 31 56 26 53 25 51 30Z',
  ],
  guard: [
    'M50 30V12H77V25L70 21 62 21 58 25 58 30Z',
    'M48 32V12H80V25L76 22 68 21 65 26 64 31Z',
    'M49 32V12H79V32Z',
    'M49 25V12H77V31H65L63 23 58 21 54 23Z',
  ],
  elder: [
    'M43 42V12H77V33L73 31 70 24 64 26 59 32 56 40 52 45Z',
    'M48 44V12H81V31L75 25 73 23 68 28 63 33 62 40 56 45Z',
    'M47 44V12H82V44Z',
    'M48 33V12H80V40L73 44 64 38 61 33 57 28 53 25 52 24 51 30Z',
  ],
} as const

const portraitIrises = {
  scout: {
    neutral: [
      [141, 122, 2.8],
      [174, 120, 2.5],
    ],
    happy: [
      [146, 115, 2.7],
      [181, 112, 2],
    ],
    angry: [
      [140, 125, 2.5],
      [174, 124, 2.3],
    ],
    sad: [
      [141, 124, 2.2],
      [176, 126, 2.1],
    ],
    surprised: [
      [145, 112, 3.2],
      [179, 111, 2.5],
    ],
  },
  ranger: {
    neutral: [
      [148, 91, 2.8],
      [181, 89, 2.2],
    ],
    happy: [
      [151, 89, 2.9],
      [185, 86, 2.1],
    ],
    angry: [
      [143, 98, 2.5],
      [176, 98, 2],
    ],
    sad: [
      [149, 104, 2.2],
      [181, 104, 1.6],
    ],
    surprised: [
      [147, 88, 3.7],
      [180, 85, 2.7],
    ],
  },
  guard: {
    neutral: [
      [143, 82, 2.2],
      [174, 79, 1.8],
    ],
    happy: [
      [144, 78, 2.1],
      [176, 76, 1.8],
    ],
    angry: [
      [141, 95, 1.8],
      [173, 94, 1.7],
    ],
    sad: [
      [144, 100, 1.8],
      [179, 102, 1.7],
    ],
    surprised: [
      [145, 83, 3],
      [178, 82, 2.7],
    ],
  },
  elder: {
    neutral: [
      [146, 87, 2.6],
      [181, 87, 2.1],
    ],
    happy: [
      [149, 85, 2.1],
      [181, 83, 1.7],
    ],
    angry: [
      [148, 90, 2.2],
      [183, 89, 1.7],
    ],
    sad: [
      [149, 92, 1.7],
      [181, 94, 1.5],
    ],
    surprised: [
      [148, 77, 3],
      [179, 77, 2.4],
    ],
  },
} as const satisfies Record<Identity, Record<AppearanceExpression, readonly Iris[]>>

const fieldIrises = {
  scout: [
    [
      [63, 43, 1.1],
      [69, 42, 1],
    ],
    [[74, 41, 1.1]],
    [],
    [[53, 39, 1.1]],
  ],
  ranger: [
    [
      [65, 31, 1],
      [71, 30, 0.9],
    ],
    [[73, 30, 1]],
    [],
    [[54, 32, 1]],
  ],
  guard: [
    [
      [64, 26, 1],
      [72, 25, 0.9],
    ],
    [[74, 25, 1]],
    [],
    [[54, 25, 1]],
  ],
  elder: [
    [
      [64, 32, 1],
      [71, 32, 0.9],
    ],
    [[74, 32, 1]],
    [],
    [[54, 29, 1]],
  ],
} as const satisfies Record<Identity, readonly (readonly Iris[])[]>

const sourceHair = {
  scout: [88, 70, 63],
  ranger: [82, 66, 54],
  guard: [69, 56, 49],
  elder: [152, 142, 132],
} as const

function pigmentFilter(id: string, rgb: readonly number[], midpoint: number, gain: number) {
  const matrix = rgb.map((channel) =>
    [0.21 * gain, 0.72 * gain, 0.07 * gain, 0, (channel - midpoint * gain) / 255].join(' '),
  )
  return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix values="${matrix.join(' ')} 0 0 0 1 0"/></filter>`
}

const irises = (eyes: readonly Iris[], dx = 0) =>
  eyes.map(([x, y, radius]) => `<circle cx="${x + dx}" cy="${y}" r="${radius}"/>`).join('')

export function paintedFeatureDyes(look: PaintedWardrobeLook, expression?: AppearanceExpression) {
  const hair = WARDROBE_HAIR_COLORS[look.hairDye].rgb
  const eyes = WARDROBE_EYE_COLORS[look.eyeColor].rgb
  const { identity } = look
  const hairClip = expression
    ? `<path d="${portraitScalps[identity]}"/>`
    : fieldScalps[identity]
        .map((d, i) => `<path transform="translate(${128 * i})" d="${d}"/>`)
        .join('')
  const irisClip = expression
    ? irises(portraitIrises[identity][expression])
    : fieldIrises[identity].map((eye, i) => irises(eye, i * 128)).join('')
  return (
    (hair
      ? `<clipPath id="hair-region">${hairClip}</clipPath>` +
        pigmentFilter('hair-tint', hair, sourceHair[identity][1], 0.82)
      : '') +
    (eyes
      ? `<clipPath id="iris-region">${irisClip}</clipPath>` +
        pigmentFilter('iris-tint', eyes, 103, 1.32)
      : '')
  )
}

export function paintedFeatureComposite(look: PaintedWardrobeLook, image: string) {
  return (
    [
      [look.hairDye, 'hair-region', 'hair-tint'],
      [look.eyeColor, 'iris-region', 'iris-tint'],
    ] as const
  )
    .filter(([pigment]) => pigment !== 'natural')
    .map(
      ([, clip, filter]) =>
        `<g clip-path="url(#${clip})"><use href="#${image}" filter="url(#${filter})"/></g>`,
    )
    .join('')
}

const portraitHairAnchors = {
  scout: [79, 39, 1.04],
  ranger: [87, 31, 1],
  guard: [92, 34, 1.04],
  elder: [80, 37, 1],
} as const

const fieldHairAnchors = {
  scout: [
    [56, 23],
    [53, 23],
    [64, 22],
    [76, 21],
  ],
  ranger: [
    [54, 20],
    [55, 17],
    [64, 17],
    [73, 20],
  ],
  guard: [
    [57, 16],
    [54, 17],
    [64, 15],
    [69, 16],
  ],
  elder: [
    [56, 21],
    [55, 19],
    [64, 18],
    [73, 18],
  ],
} as const satisfies Record<Identity, readonly Point[]>

const hairSilhouettes = {
  topknot: {
    body: 'M-21 15C-28 8-26-4-18-9c-8-12 3-24 19-22 13-3 22 9 16 19-2 7-9 12-18 13l8 17Z',
    highlights: 'M-16-10c-8-7-1-17 8-18m1 18c-6-7 1-15 9-16m0 18c10-7 12-12 8-15M-20 9q2-11 14-14',
  },
  braid: {
    body: 'M-11 1c-26 13-27 31-20 56-17 12-18 27-12 44-9 10-9 25-3 34-4 17 1 31 11 42 2-14 11-21 10-37 12-10 13-26 7-38 11-16 10-34 2-47 8-15 14-30 5-54Z',
    highlights:
      'M-27 32q-1 16 10 25m-19-3q-4 12 18 25m-21-4q-4 11 20 19m-24-3q-3 10 21 20m-23 1q-2 10 18 17m-20 1 17 13',
  },
  waves: {
    body: 'M-13-6c-23 3-32 23-31 47-12 17 1 33-9 50-8 12-5 24 0 30-5 14-2 22 6 28-4-18 11-26 13-39 6 11-1 23 9 30-6-20 13-27 11-48 11 9-2 26 11 31-3-16 13-28 7-49C-6 48 18 16-13-6Z',
    highlights:
      'M-38 36c-13 18 2 29-9 50-6 12-1 22-4 29m19-79c-5 17 6 29-2 49-6 17 2 26-1 35m14-86c-9 20 4 29-2 47-5 13 2 20 4 24m6-78c-7 19 2 24 0 41',
  },
} as const

export function paintedHairSilhouette(look: PaintedWardrobeLook, facing?: AppearanceFacing) {
  if (look.hairstyle === 'natural') return ''
  const { body, highlights } = hairSilhouettes[look.hairstyle]
  const portrait = !facing
  const [x, y, scale] = portrait
    ? portraitHairAnchors[look.identity]
    : [...fieldHairAnchors[look.identity][APPEARANCE_FACINGS.indexOf(facing)]!, 0.26]
  const rgb = WARDROBE_HAIR_COLORS[look.hairDye].rgb ?? sourceHair[look.identity]
  const tone = (factor: number) =>
    `rgb(${rgb.map((channel) => Math.round(channel * factor)).join(',')})`
  const depth = `hair-depth-${facing ?? 'portrait'}`
  const fieldTransform = portrait ? '' : 'translate(3.52 7.44) scale(.32)'
  return `<g transform="${fieldTransform} translate(${x} ${y}) scale(${facing === 'west' ? -scale : scale} ${scale})">
    <defs><linearGradient id="${depth}" x2="80%" y2="90%">
      <stop stop-color="${tone(1.18)}"/><stop offset="1" stop-color="${tone(0.64)}"/>
    </linearGradient></defs>
    <path d="${body}" fill="url(#${depth})" stroke="${tone(0.54)}" stroke-width="2.5"/>
    <path d="${highlights}" fill="none" stroke="${tone(0.53)}" stroke-width="2.6" opacity=".72" transform="translate(-1.3 1.8)"/>
    <path d="${highlights}" fill="none" stroke="${tone(1.29)}" stroke-width="1.35" opacity=".76"/>
    ${look.hairstyle === 'braid' ? '<path d="M-44 140q7 4 16 2" stroke="#9e7850" stroke-width="4"/>' : ''}
  </g>`
}
