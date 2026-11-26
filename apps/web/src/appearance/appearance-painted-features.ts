import facePalettes from './appearance-face-palette.json'
import {
  APPEARANCE_FACINGS,
  type AppearanceExpression,
  type AppearanceFacing,
} from './appearance-manifest'
import {
  PLAYER_EYE_COLORS,
  WARDROBE_HAIR_COLORS,
  type PaintedPlayerLook,
  type PaintedWardrobeLook,
} from './appearance-painted-wardrobe'
import { PAINTED_HAIRSTYLES } from './appearance-painted-hairstyles.generated'

type Identity = PaintedPlayerLook['identity']
type Point = readonly [x: number, y: number]
type Iris = readonly [x: number, y: number, radius: number]

// Scalp and iris regions follow the four original painted models. The portrait
// irises move independently in each expression, while field crops use 128×176.
const portraitScalps = {
  pinescout:
    'M46 125L43 70 61 33 95 17 129 6 164 9 195 38 217 70 211 100 187 120 186 88 180 64 172 45 161 32 153 43 144 51 133 59 122 66 112 83 115 94 107 106 103 123 113 148 127 180 139 211 141 240 128 253 96 250 82 228 89 200 71 166 47 153Z',
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
  pinescout: [
    'M48 17H78V30L71 29 67 25 62 31 58 36 61 48 58 57H51L49 44Z',
    'M48 17H79V30L73 29 67 27 62 32 62 44 57 53H51Z',
    'M45 17H83V44L71 53 58 55 50 48Z',
    'M46 17H78V45L73 54 62 49 65 39 60 30 53 27 49 32Z',
  ],
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

export const PAINTED_PORTRAIT_IRISES = {
  pinescout: {
    neutral: [
      [132, 74, 2.8],
      [168, 77, 2.4],
    ],
    happy: [
      [132, 72, 2.7],
      [169, 76, 2.4],
    ],
    angry: [
      [130, 88, 2.3],
      [167, 89, 2.3],
    ],
    sad: [
      [132, 89, 2.4],
      [169, 90, 2.3],
    ],
    surprised: [
      [132, 74, 3.1],
      [168, 77, 2.8],
    ],
  },
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
  pinescout: [
    [
      [66, 30, 1],
      [72, 29, 0.8],
    ],
    [[75, 30, 1]],
    [],
    [[52, 30, 1]],
  ],
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
  pinescout: [146, 77, 43],
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

// Registered scalp and iris landmarks for the straight-on field plates in the motion atlas.
const frontalFeatures = {
  scout: { scalp: 'M47 18H82V40L75 47 74 39 70 33 68 37 63 34 59 39 55 37 54 47 47 42Z', eyeY: 40 },
  ranger: {
    scalp: 'M50 14H78V32L76 40 71 34 67 25 63 24 58 29 56 37 59 39 57 57 51 64 49 58 52 40Z',
    eyeY: 32,
  },
  guard: { scalp: 'M54 11H75L74 26 71 19 66 20 58 19 55 27Z', eyeY: 24 },
  elder: {
    scalp: 'M50 16H78L81 33 75 41 72 37 73 31 68 25 63 24 58 27 57 35 53 41 47 33Z',
    eyeY: 32,
  },
  pinescout: {
    scalp:
      'M48 14H79L79 38 75 43 72 35 70 27 67 25 60 29 59 36 54 40 56 53 54 64 49 66 48 60 51 50Z',
    eyeY: 32,
  },
} as const

export function paintedFeatureDyes(
  look: PaintedWardrobeLook | PaintedPlayerLook,
  expression?: AppearanceExpression,
  frontal = false,
) {
  const hair = WARDROBE_HAIR_COLORS[look.hairDye].rgb
  const eyes = PLAYER_EYE_COLORS[look.eyeColor].rgb
  const { identity } = look
  const hairClip = expression
    ? `<path d="${portraitScalps[identity]}"/>`
    : fieldScalps[identity]
        .map(
          (d, i) =>
            `<path transform="translate(${128 * i})" d="${frontal && i === 0 ? frontalFeatures[identity].scalp : d}"/>`,
        )
        .join('')
  const irisClip = expression
    ? irises(PAINTED_PORTRAIT_IRISES[identity][expression])
    : fieldIrises[identity]
        .map((eye, i) =>
          frontal && i === 0
            ? irises([
                [60.5, frontalFeatures[identity].eyeY, 1],
                [67.5, frontalFeatures[identity].eyeY, 1],
              ])
            : irises(eye, i * 128),
        )
        .join('')
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

export function paintedFeatureComposite(
  look: PaintedWardrobeLook | PaintedPlayerLook,
  image: string,
) {
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
  pinescout: [84, 35, 1.05],
  scout: [79, 39, 1.04],
  ranger: [87, 31, 1],
  guard: [92, 34, 1.04],
  elder: [80, 37, 1],
} as const

const portraitFringeAnchors = {
  pinescout: [131, 42, 1.06],
  scout: [123, 62, 1.15],
  ranger: [124, 52, 1.07],
  guard: [119, 43, 1.02],
  elder: [120, 55, 1.15],
} as const

const fieldHairAnchors = {
  pinescout: [
    [55, 24],
    [52, 24],
    [64, 23],
    [75, 24],
  ],
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

type HairSilhouette = {
  body: string
  highlights: string
  front?: boolean
  strands?: string
}

const hairSilhouettes: Record<
  Exclude<PaintedWardrobeLook['hairstyle'], 'natural'>,
  HairSilhouette
> = {
  feather: {
    front: true,
    body: 'M-45 23Q-47-13-20-25Q0-35 22-25Q38-22 44-4Q27-16 18-10Q30-1 34 14Q18 1 6 2L14 24Q0 10-14 10L-8 29Q-25 19-31 13Z',
    highlights:
      'M-40 15Q-29-17 5-23M-30 11Q-15-12 19-17M-19 12Q-5-7 18-8M-7 14Q2 1 17 1M22-14q13 3 17 9',
    strands:
      'M-42 3Q-29-24-4-26M-37 7Q-20-16 3-22M-33 18Q-15-11 16-19M-24 16Q-11-4 8-10M-19 19Q-10 5 0 1M-3 19Q3 7 14 5M8-25q21 1 28 13',
  },
  quiff: {
    front: true,
    body: 'M-43 24Q-49 0-33-15Q-22-27-7-26Q21-43 44-28Q24-25 17-12Q33-14 43-5Q24-7 13 5Q-9 11-18 25L-24 18L-35 29Z',
    highlights:
      'M-39 19Q-34-13-4-20Q15-32 31-29M-32 17Q-24-7 0-13Q10-22 23-24M-22 15Q-11-4 16-7M-9 14Q6 2 23 0',
    strands:
      'M-39 10Q-29-14-10-18Q17-35 35-30M-35 19Q-24-3-2-11Q14-25 29-26M-29 21Q-16 1 7-8M-14 16Q1 2 25-2M4 11Q13 3 30 0',
  },
  curls: {
    front: true,
    body: 'M-45 18Q-52 10-46 2Q-53-13-39-17Q-36-30-22-25Q-13-38-1-30Q12-38 21-29Q36-32 38-20Q51-17 45-4Q52 8 41 13Q34 22 25 12Q18 23 8 16Q0 29-13 19Q-24 32-34 20Q-42 28-45 18Z',
    highlights:
      'M-44 8q9-7 11 2q-1 5-6 5M-39-10q12-8 14 4q0 6-5 7M-23-18q10-8 15 2q1 7-6 9M-7-20q13-10 18 2q2 6-6 10M16-20q11-6 15 3q1 7-5 9M31-5q13-2 9 9M-15 7q12-9 15 4M7 5q10-9 14 2',
    strands:
      'M-42-5q8-7 11 0M-27 3q7-11 15-6M-24-18q9-6 13 1M-11-25q8-5 14 0M-2-15q7-6 10 0M11-8q8-7 13-2M20-23q7-3 11 3M29 8q6-8 11-4M-9 10q5-6 10-2M9 9q7-7 12-3',
  },
  crown: {
    front: true,
    body: 'M-48 9Q-47-7-32-11Q-27-24-12-20Q-3-28 7-24Q20-29 28-19Q42-19 47-7Q46 2 39 4Q28-4 20-1Q12-6 3-2Q-8-6-15 1Q-27-1-31 10Q-44 20-48 9Z',
    highlights:
      'M-45 8q4-9 13-12m-5 15q6-13 15-18m-5 10q7-15 17-17m-6 13q9-14 17-15m-6 12q12-11 20-10M8-4q11-10 20-6M22-4q13-7 21-2',
    strands:
      'M-43 5q5-8 13-10M-30 4q6-10 14-13M-18-3q6-11 16-14M-5-10q8-9 16-9M7-12q10-7 17-5M20-11q9-3 16 0M31-8q7-1 12 3',
  },
  layers: {
    body: 'M-9-9Q-42-10-47 31Q-55 55-54 77Q-54 92-66 106Q-49 103-36 88Q-43 107-43 123Q-24 109-17 89L-24 119Q-2 104 8 79Q14 104 26 115L26 92Q37 106 57 108Q45 83 46 60Q53 24 31 3Q13-12-9-9Z',
    highlights:
      'M-39 26Q-50 68-48 88M-31 21Q-38 48-32 61Q-33 84-45 98M-18 23Q-31 57-24 69Q-24 88-30 97M29 18Q43 38 38 61Q37 87 47 98',
    strands:
      'M-43 38Q-47 60-51 75M-36 46Q-41 67-40 80M-35 77Q-38 92-44 99M-26 61Q-25 79-35 98M34 37q5 14 3 27M40 67q-2 19 11 33',
  },
  bun: {
    body: 'M-13 16Q-31 25-38 41Q-58 38-63 53Q-72 75-55 85Q-40 95-27 83Q-18 78-26 65Q-16 58-10 43Z',
    highlights:
      'M-20 29Q-34 36-40 49M-34 49Q-52 40-58 54Q-62 64-57 73M-31 60Q-43 47-53 57Q-59 69-48 77M-32 69Q-41 59-46 64Q-48 69-42 74',
    strands:
      'M-29 45Q-45 44-52 52M-58 53Q-65 66-54 77M-54 57Q-59 68-48 75M-51 60Q-55 70-46 74M-42 70Q-42 76-34 80M-55 78q10 7 20 3',
  },
  topknot: {
    body: 'M-21 15C-28 8-26-4-18-9c-8-12 3-24 19-22 13-3 22 9 16 19-2 7-9 12-18 13l8 17Z',
    highlights: 'M-16-10c-8-7-1-17 8-18m1 18c-6-7 1-15 9-16m0 18c10-7 12-12 8-15M-20 9q2-11 14-14',
  },
  braid: {
    body: 'M-11 1c-26 13-27 31-20 56-17 12-18 27-12 44-9 10-9 25-3 34-4 17 1 31 11 42 2-14 11-21 10-37 12-10 13-26 7-38 11-16 10-34 2-47 8-15 14-30 5-54Z',
    highlights:
      'M-27 32q-1 16 10 25m-19-3q-4 12 18 25m-21-4q-4 11 20 19m-24-3q-3 10 21 20m-23 1q-2 10 18 17m-20 1 17 13',
  },
  pony: {
    body: 'M-9 12Q-24 5-37 13Q-59 9-69 28Q-82 47-70 66Q-63 82-77 96Q-88 108-82 124Q-77 111-68 108Q-51 105-43 90Q-34 72-43 51Q-46 35-28 36Q-14 40-9 31Z',
    highlights:
      'M-35 18Q-64 13-70 38Q-77 52-65 70Q-55 92-76 108M-39 22Q-61 21-64 40Q-69 50-58 66Q-46 90-65 101M-47 30Q-58 35-57 44Q-58 54-50 63M-28 14Q-37 23-29 35',
    strands:
      'M-43 17Q-56 17-66 27M-69 30Q-80 46-70 63M-64 32Q-73 49-63 61M-61 38Q-67 48-57 62M-63 73Q-59 92-76 111M-57 73Q-54 91-69 104M-52 70Q-47 81-56 95',
  },
  twins: {
    body: 'M-13 13Q-50 8-51 40Q-61 48-53 63Q-61 77-54 93Q-61 105-54 122Q-55 138-46 153Q-36 143-40 122Q-31 110-39 94Q-28 83-35 67Q-26 54-34 43Q-19 39-13 13ZM69 13Q100 4 104 32Q115 43 106 60Q115 74 108 90Q115 104 109 119Q112 136 103 149Q93 139 95 123Q84 110 92 95Q81 80 91 65Q80 52 88 37Q73 37 69 13Z',
    highlights:
      'M-49 43Q-46 55-36 59M-52 65Q-48 78-38 81M-52 88Q-47 100-41 105M-51 113l11 9M105 35Q103 47 91 55M108 59Q103 74 93 78M107 88Q103 100 93 106M107 113l-12 11',
    strands:
      'M-46 46q1 6 8 11m-10 12q3 7 9 10m-9 13q2 7 7 10m-8 13 8 6M102 39q-4 9-10 13m12 12q-2 8-10 12m11 15q-4 9-10 13m10 12-8 7',
  },
  waves: {
    body: 'M-13-6c-23 3-32 23-31 47-12 17 1 33-9 50-8 12-5 24 0 30-5 14-2 22 6 28-4-18 11-26 13-39 6 11-1 23 9 30-6-20 13-27 11-48 11 9-2 26 11 31-3-16 13-28 7-49C-6 48 18 16-13-6Z',
    highlights:
      'M-38 36c-13 18 2 29-9 50-6 12-1 22-4 29m19-79c-5 17 6 29-2 49-6 17 2 26-1 35m14-86c-9 20 4 29-2 47-5 13 2 20 4 24m6-78c-7 19 2 24 0 41',
  },
} as const

const paintedHairFits = {
  feather: { crown: true, front: true, width: 136, x: -4, top: -43 },
  quiff: { crown: true, front: true, width: 131, x: 2, top: -46 },
  curls: { crown: true, front: true, width: 133, x: -1, top: -40 },
  crown: { crown: true, front: true, width: 126, x: 0, top: -22 },
  layers: { crown: false, front: false, width: 190, x: 43, top: -22 },
  bun: { crown: false, front: false, width: 78, x: -14, top: 27 },
  topknot: { crown: true, front: true, width: 84, x: -23, top: -69 },
  pony: { crown: false, front: false, width: 103, x: -4, top: 32 },
  braid: { crown: false, front: true, width: 57, x: 5, top: 74 },
  twins: { crown: false, front: true, width: 122, x: 43, top: 58 },
  waves: { crown: false, front: false, width: 103, x: -7, top: 56 },
} as const

function paintedPlayerHairLayers(look: PaintedPlayerLook, facing?: AppearanceFacing) {
  const { hairstyle, identity, hairDye } = look
  if (hairstyle === 'natural' || !Object.hasOwn(paintedHairFits, hairstyle))
    return ['', ''] as const
  const registeredHair = hairstyle as keyof typeof paintedHairFits
  const { crown, front, width, x, top } = paintedHairFits[registeredHair]
  const asset = PAINTED_HAIRSTYLES[registeredHair]
  const fieldScale = facing ? 0.25 : 1
  const visualWidth = width * fieldScale
  const height = (visualWidth * asset.height) / asset.width
  const [anchorX, anchorY] = facing
    ? fieldHairAnchors[identity][APPEARANCE_FACINGS.indexOf(facing)]!
    : (crown ? portraitFringeAnchors : portraitHairAnchors)[identity]
  const center = facing && crown ? 64 : anchorX
  const artX = center + x * fieldScale - visualWidth / 2
  const artY = Math.max(facing ? 2 : 0, anchorY + top * fieldScale)
  const filter = `painted-hair-dye-${facing ?? 'portrait'}`
  const painted =
    look.faceId && Object.hasOwn(facePalettes, look.faceId)
      ? facePalettes[look.faceId as keyof typeof facePalettes]
      : null
  const pigment = WARDROBE_HAIR_COLORS[hairDye].rgb ?? painted?.hair ?? sourceHair[identity]
  const transform = facing
    ? `translate(3.52 7.44) scale(.32)${facing === 'west' ? ` translate(${center * 2} 0) scale(-1 1)` : ''}`
    : ''
  const art = `<g transform="${transform}"><defs>${pigmentFilter(filter, pigment, 101, 0.83)}</defs>
    <image href="${asset.uri}" x="${artX}" y="${artY}" width="${visualWidth}" height="${height}" filter="url(#${filter})"/>
  </g>`
  return front ? (['', art] as const) : ([art, ''] as const)
}

export function paintedHairLayers(
  look: PaintedWardrobeLook | PaintedPlayerLook,
  facing?: AppearanceFacing,
) {
  if ('backdrop' in look) return paintedPlayerHairLayers(look, facing)
  if (look.hairstyle === 'natural') return ['', ''] as const
  const { body, highlights, front, strands } = hairSilhouettes[look.hairstyle]
  const fieldAnchor = facing && fieldHairAnchors[look.identity][APPEARANCE_FACINGS.indexOf(facing)]
  const [x, y, scale] = fieldAnchor
    ? front
      ? [64, fieldAnchor[1] + 3, 0.31]
      : [...fieldAnchor, 0.26]
    : (front ? portraitFringeAnchors : portraitHairAnchors)[look.identity]
  const rgb = WARDROBE_HAIR_COLORS[look.hairDye].rgb ?? sourceHair[look.identity]
  const tone = (factor: number) =>
    `rgb(${rgb.map((channel) => Math.round(channel * factor)).join(',')})`
  const depth = `hair-depth-${facing ?? 'portrait'}`
  const fieldTransform = facing ? 'translate(3.52 7.44) scale(.32)' : ''
  if (strands) {
    const art = `<g transform="${fieldTransform} translate(${x} ${y}) scale(${facing === 'west' ? -scale : scale} ${scale})">
      <defs><radialGradient id="${depth}" cx="32%" cy="22%" r="85%">
        <stop stop-color="${tone(1.25)}"/>
        <stop offset=".44" stop-color="${tone(0.98)}"/>
        <stop offset="1" stop-color="${tone(0.66)}"/>
      </radialGradient></defs>
      <path d="${body}" fill="url(#${depth})" stroke="${tone(0.62)}" stroke-width="1.6" stroke-linejoin="round"/>
      <g fill="none" stroke-linecap="round">
        <path d="${highlights}" stroke="${tone(0.62)}" stroke-width="3.2" opacity=".49" transform="translate(.6 1.2)"/>
        <path d="${highlights}" stroke="${tone(1.34)}" stroke-width="1.55" opacity=".56"/>
        ${facing ? '' : `<path d="${strands}" stroke="${tone(1.52)}" stroke-width=".72" opacity=".31"/>`}
      </g>
    </g>`
    return front ? (['', art] as const) : ([art, ''] as const)
  }
  const art = `<g transform="${fieldTransform} translate(${x} ${y}) scale(${facing === 'west' ? -scale : scale} ${scale})">
    <defs><linearGradient id="${depth}" x2="80%" y2="90%">
      <stop stop-color="${tone(1.18)}"/><stop offset="1" stop-color="${tone(0.64)}"/>
    </linearGradient></defs>
    <path d="${body}" fill="url(#${depth})" stroke="${tone(0.54)}" stroke-width="2.5"/>
    <path d="${highlights}" fill="none" stroke="${tone(0.53)}" stroke-width="2.6" opacity=".72" transform="translate(-1.3 1.8)"/>
    <path d="${highlights}" fill="none" stroke="${tone(1.29)}" stroke-width="1.35" opacity=".76"/>
    ${look.hairstyle === 'braid' ? '<path d="M-44 140q7 4 16 2" stroke="#9e7850" stroke-width="4"/>' : ''}
  </g>`
  return [art, ''] as const
}
