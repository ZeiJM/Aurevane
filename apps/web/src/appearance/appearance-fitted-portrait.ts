import { FITTED_ACCESSORY_ART } from './appearance-fitted-accessories.generated'
import { FITTED_FACEWEAR, FITTED_HEADWEAR } from './appearance-fitted-accessories'
import { FITTED_ART_SOURCE } from './appearance-fitted-source.generated'
import type {
  AppearanceExpression,
  AppearanceFacing,
  PaintedPlayerAppearanceBlueprint,
} from './appearance-manifest'
import { paintedPigmentFilter } from './appearance-painted-equipment'
import { PAINTED_SPRITE_HEADS } from './appearance-painted-sprite-heads.generated'
import { PAINTED_SPRITE_COLLAR_Y } from './appearance-painted-sprite-rig'
import {
  WARDROBE_DYES,
  WARDROBE_EYE_COLORS,
  WARDROBE_FRAMES,
  WARDROBE_HAIR_COLORS,
  WARDROBE_SKIN_TONES,
  type PaintedPlayerLook,
} from './appearance-painted-wardrobe'
import { PORTRAIT_EXPRESSION_MAPS } from './appearance-portrait-expression-maps.generated'
import {
  fitPortraitAccessories,
  fittedFacialHairTarget,
  fittedHairTarget,
  fitPortraitLayer,
  renderFittedPortrait,
  type PortraitAnchors,
  type PortraitFaceLandmarks,
} from './appearance-portrait-fit'

type SourceName = keyof typeof FITTED_ART_SOURCE

export const FITTED_HAIR_ART = {
  natural: 'feathery-adventurer-cut',
  feather: 'feathered-crop',
  quiff: 'copper-quiff',
  curls: 'soft-round-ringlets',
  crown: 'knotted-swept-crown',
  layers: 'lifted-chestnut-layers',
  bun: 'loose-low-bun',
  topknot: 'high-topknot',
  pony: 'wrapped-low-tail',
  braid: 'regular-shoulder-braid',
  twins: 'twin-braids',
  waves: 'silvertip-waves',
  crop: 'close-crop',
  sidepart: 'neat-side-part',
  pixie: 'wind-pixie',
  shag: 'golden-shag',
  sidefringe: 'deep-side-fringe',
  spiked: 'storm-spikes',
  frosted: 'finely-waved-pompadour',
  brushed: 'wind-crop',
  loosequiff: 'soft-loose-quiff',
  coils: 'high-coiled-puff',
  ringlets: 'long-cascade-curls',
  curlsweep: 'chestnut-swept-curls',
  coronet: 'braided-coronet',
  halo: 'double-crown-braid',
  ropebraid: 'copper-rope-crown',
  razor: 'raven-razor-layers',
  curtain: 'auburn-curtain-layers',
  pageboy: 'blunt-pageboy',
  tightbun: 'sleek-low-bun',
  loosebun: 'ribbonless-loose-bun',
  sidebun: 'side-bun',
  warrior: 'warrior-knot',
  doublenot: 'twin-knots',
  hightwist: 'high-rope-twist',
  highpony: 'high-ponytail',
  lowpony: 'sleek-low-tail',
  sidepony: 'swept-side-tail',
  fishtail: 'woven-fishtail',
  loosebraid: 'spread-loose-braid',
  longbraid: 'long-forward-braid',
  twinloops: 'braid-loops',
  twinlow: 'low-twin-braids',
  twinribbons: 'ribbon-twin-braids',
  mermaid: 'flowing-mermaid-waves',
  softwave: 'soft-russet-waves',
  silkwave: 'silken-black-waves',
} as const satisfies Record<PaintedPlayerLook['hairstyle'], SourceName>

const fittedGarments = {
  none: 'embroidered-wayfarer-shirt',
  compass: 'courier-mantle',
  pine: 'moss-cloak',
  hawkmantle: 'hawk-feather-mantle',
  shearling: 'shearling-surcoat',
  scarf: 'teal-trail-scarf',
  brigandine: 'road-brigandine',
  brocade: 'bronze-court-brocade',
  hooded: 'night-travel-mantle',
  quilted: 'rust-trail-jacket',
} as const satisfies Record<PaintedPlayerLook['outerwear'], SourceName>

const fittedBeards = {
  stubble: 'short-stubble',
  moustache: 'thin-moustache',
  goatee: 'pointed-goatee',
  anchor: 'anchor-beard',
  boxed: 'trimmed-boxed-beard',
  full: 'salt-and-pepper-beard',
  braided: 'two-braid-beard',
} as const satisfies Record<
  Exclude<PaintedPlayerLook['facialHair'], 'none' | undefined>,
  SourceName
>

const fittedGear = {
  utility: 'tool-belt-strap',
  mapcase: 'map-folio-satchel',
  potions: 'potion-sash-strap',
  bedroll: 'rolled-bedroll',
  journal: 'lantern-journal-strap',
  rope: 'woven-hunter-rope',
  sword: 'sword-scabbard-belt',
  girdle: 'archivist-brocade-girdle',
} as const satisfies Record<Exclude<PaintedPlayerLook['gear'], 'none'>, SourceName>

const gearPlacement = {
  utility: 'waist',
  mapcase: 'sash',
  potions: 'sash',
  bedroll: 'behind',
  journal: 'waist',
  rope: 'shoulder',
  sword: 'waist',
  girdle: 'waist',
} as const satisfies Record<keyof typeof fittedGear, string>

const replacementHeadwear: Partial<
  Record<PaintedPlayerLook['headwear'], keyof typeof FITTED_HEADWEAR>
> = {
  arcanist: 'astronomerhat',
  bandana: 'wayfarercap',
  furcap: 'stormcap',
  circlet: 'tidecirclet',
}

const replacementFacewear = {
  eyepatch: 'ravenpatch',
  goggles: 'explorergoggles',
  veil: 'garnetveil',
  mask: 'bronzemasque',
} as const

type Pigment = readonly [number, number, number]

function pigmentCss(pigment: Pigment, shade = 1) {
  return `rgb(${pigment.map((channel) => Math.round(channel * shade)).join(',')})`
}

function calibratedSkinFilter(id: string, tone: Pigment | null, light: Pigment) {
  if (!tone) return ''
  const sourceLuminance = luminance(light)
  const slope = Math.max(0.46, Math.min(1.1, luminance(tone) / Math.max(55, sourceLuminance)))
  const matrix = tone.flatMap((channel) => [
    0.2126 * slope,
    0.7152 * slope,
    0.0722 * slope,
    0,
    (channel - sourceLuminance * slope) / 255,
  ])
  return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${matrix.join(' ')} 0 0 0 1 0"/></filter>`
}

const registeredFaces = {
  f01: {
    source: 'river-scholar',
    eyeWidth: 22,
    temple: 48,
    chin: 157,
    neck: 21,
    skin: ['#b48164', '#744f38'],
  },
  f02: {
    source: 'storm-navigator',
    eyeWidth: 23,
    temple: 50,
    chin: 158,
    neck: 23,
    skin: ['#a16b43', '#694a38'],
  },
  m01: {
    source: 'night-courier',
    eyeWidth: 23,
    temple: 51,
    chin: 164,
    neck: 22,
    skin: ['#b0815e', '#7c543c'],
  },
  m02: {
    source: 'bronze-warden',
    eyeWidth: 25,
    temple: 54,
    chin: 163,
    neck: 25,
    skin: ['#aa7854', '#764c36'],
  },
} as const

const classicFaceSources = {
  pinescout: 'f01',
  ranger: 'f02',
  scout: 'm01',
  guard: 'm02',
  elder: 'm57',
} as const

const rigOffsets = { pinescout: 0, ranger: 7, scout: 13, guard: 19, elder: 27 } as const

function fittedFace(look: PaintedPlayerAppearanceBlueprint) {
  const id = look.faceId ?? classicFaceSources[look.identity]
  const authored = registeredFaces[id as keyof typeof registeredFaces]
  if (authored) return authored

  const feminine = look.identity === 'pinescout' || look.identity === 'ranger'
  const faceIndex = Number(/^.[0-9]+/.exec(id)?.[0].slice(1) ?? 73 + rigOffsets[look.identity])
  const index = (faceIndex + 25) % 28
  const category =
    index < 12 ? (feminine ? 'adultWomen' : 'adultMen') : feminine ? 'secondWomen' : 'secondMen'
  const source = `${category}-${index < 12 ? index + 1 : index - 11}` as SourceName
  const shape = id.endsWith('soft') ? 1 : id.endsWith('keen') ? -1 : 0
  const seed = faceIndex + rigOffsets[look.identity] + (feminine ? 0 : 71)
  const base = FITTED_ART_SOURCE[source]
  const pigments =
    'neckPigments' in base
      ? base.neckPigments
      : ([
          [170, 119, 85],
          [120, 76, 57],
        ] as const)
  return {
    source,
    eyeWidth: 20.7 + ((seed * 11) % 29) * 0.15 + shape * 0.6,
    temple: (feminine ? 45 : 49) + ((seed * 7) % 37) * 0.2 + shape * 2.6,
    chin: (feminine ? 155 : 159) + ((seed * 17) % 47) * 0.16 - shape * 2.1,
    neck: (feminine ? 20 : 22) + ((seed * 19) % 17) * 0.2,
    skin: [pigmentCss(pigments[0]), pigmentCss(pigments[1])] as const,
  }
}

function faceLandmarks(
  face: ReturnType<typeof fittedFace>,
  youthful = false,
): PortraitFaceLandmarks {
  const source = FITTED_ART_SOURCE[face.source]
  const eyes = [128 - face.eyeWidth, 128 + face.eyeWidth] as const
  const eyesY = 98
  const chin = face.chin - (youthful ? 3 : 0)
  const fit = fitPortraitLayer(source.anchors, {
    left: eyes[0],
    right: eyes[1],
    top: eyesY,
    bottom: chin,
  })
  const projectY = (fraction: number) => fit.origin[1] + fraction * source.height * fit.scaleY
  const guides = 'facialGuides' in source ? source.facialGuides : undefined
  const center = guides ? fit.origin[0] + guides.center * source.width * fit.scaleX : 128
  return {
    eyes,
    eyesY,
    temples: [128 - face.temple, 128 + face.temple],
    hairline: 67,
    brow: 89,
    nose: guides ? projectY(guides.nose) : 116,
    mouth: guides ? [center, projectY(guides.lip)] : undefined,
    chin,
    neck: [center - face.neck, center + face.neck],
    shoulder: chin + 28,
  }
}

function fittedFaceMarks(
  look: PaintedPlayerAppearanceBlueprint,
  landmarks: PortraitFaceLandmarks,
  skin: string,
) {
  const { eyes, eyesY, nose, chin } = landmarks
  const cheekX = eyes[1] - 1
  const cheekY = nose - 3
  const marks = {
    cross: `M${cheekX} ${cheekY}l12 14m0-14-12 14`,
    cheek: `M${cheekX} ${cheekY}q4 8 12 12`,
    brow: `M${eyes[0] - 7} ${eyesY - 17}l7 9`,
    bridge: `M118 ${nose - 3}q9 3 18-3`,
    jaw: `M91 ${chin - 24}q5 8 12 12`,
    none: '',
  } as const
  const scar = marks[look.scar ?? 'none']
  const age = look.apparentAge
  const ageLines =
    age === 'elder' || age === 'mature'
      ? `<g data-age-lines="${age}" fill="none" stroke="${skin}" stroke-width="${age === 'elder' ? 1.2 : 0.7}" opacity=".46" stroke-linecap="round">
      <path d="M${eyes[0] - 14} ${eyesY + 9}q7 5 14 3m${eyes[1] - eyes[0]} 0q7 1 14-4M114 ${nose + 11}q-4 3-7 8m35-8q4 3 7 8"/>
      ${age === 'elder' ? `<path d="M106 ${eyesY - 20}q22-5 44 0m-38-5q17-3 31 0M113 ${chin - 10}q16 6 31 0"/>` : ''}
    </g>`
      : ''
  return scar
    ? `${ageLines}<g data-scar="${look.scar}" fill="none" stroke-linecap="round"><path d="${scar}" stroke="${skin}" stroke-width="1.85" opacity=".9"/><path d="${scar}" stroke="#f8d1b2" stroke-width=".72" opacity=".76" transform="translate(.6 .7)"/></g>`
    : ageLines
}

export function fittedCharacterPortrait(
  look: PaintedPlayerAppearanceBlueprint,
  expression: AppearanceExpression,
  backdrop: string,
  icon: boolean,
) {
  const face = fittedFace(look)
  const hatId = replacementHeadwear[look.headwear] ?? look.headwear
  const accessoryId =
    replacementFacewear[look.facewear as keyof typeof replacementFacewear] ?? look.facewear
  const hat = FITTED_HEADWEAR[hatId as keyof typeof FITTED_HEADWEAR]
  const accessory = FITTED_FACEWEAR[accessoryId as keyof typeof FITTED_FACEWEAR]

  const landmarks = faceLandmarks(face, look.apparentAge === 'youthful')
  const faceSource = FITTED_ART_SOURCE[face.source]
  const naturalOrDyed = <T>(
    layer: T,
    filter: string,
    pigment: readonly [number, number, number] | null,
  ) => (pigment ? { ...layer, filter } : layer)
  const hairDye = WARDROBE_HAIR_COLORS[look.hairDye].rgb
  const hair = FITTED_ART_SOURCE[FITTED_HAIR_ART[look.hairstyle]]
  const fabricDye = WARDROBE_DYES[look.clothColor].rgb
  const accentDye = look.hairAccent ? WARDROBE_HAIR_COLORS[look.hairAccent].rgb : null
  const leftEye = WARDROBE_EYE_COLORS[look.secondEye ?? look.eyeColor].rgb
  const rightEye = WARDROBE_EYE_COLORS[look.eyeColor].rgb
  const headDye = WARDROBE_DYES[look.headColor].rgb
  const accessoryDye = WARDROBE_DYES[look.faceColor].rgb
  const gearDye = WARDROBE_DYES[look.gearColor].rgb
  const skinDye = WARDROBE_SKIN_TONES[look.skinTone].rgb
  const originalSkin =
    'neckPigments' in faceSource ? faceSource.neckPigments[0] : ([170, 119, 85] as const)
  const neckPigment = skinDye
    ? ([pigmentCss(skinDye, 0.82), pigmentCss(skinDye, 0.59)] as const)
    : 'neckPigments' in faceSource
      ? ([pigmentCss(faceSource.neckPigments[0]), pigmentCss(faceSource.neckPigments[1])] as const)
      : face.skin
  const beard = look.facialHair && look.facialHair !== 'none' ? fittedBeards[look.facialHair] : null
  const beardDye = hairDye ?? ('hairPigment' in hair ? hair.hairPigment : null)
  return renderFittedPortrait(
    {
      face: naturalOrDyed(faceSource, 'painted-skin', skinDye),
      trimScalp: 'facialGuides' in faceSource,
      landmarks,
      neckPigment,
      faceMarks: fittedFaceMarks(look, landmarks, neckPigment[1]),
      expressionMap: expression !== 'neutral' ? PORTRAIT_EXPRESSION_MAPS[expression] : undefined,
      torsoScale: WARDROBE_FRAMES[look.bodyFrame].torsoScale,
      paintedFilters:
        paintedPigmentFilter('painted-hair', hairDye) +
        (beard ? paintedPigmentFilter('painted-beard', beardDye) : '') +
        paintedPigmentFilter('painted-hair-second', accentDye) +
        paintedPigmentFilter('painted-eye-left', leftEye) +
        paintedPigmentFilter('painted-eye-right', rightEye) +
        paintedPigmentFilter('painted-fabric', fabricDye) +
        calibratedSkinFilter('painted-skin', skinDye, originalSkin) +
        paintedPigmentFilter('painted-gear', gearDye) +
        paintedPigmentFilter('painted-hat', headDye) +
        paintedPigmentFilter('painted-accessory', accessoryDye),
      hair: naturalOrDyed(hair, 'painted-hair', hairDye),
      hairLength: longHair.has(look.hairstyle) ? 'long' : 'short',
      tuckHairBehindShoulders: shoulderLengthLooseHair.has(look.hairstyle),
      hairAccent: accentDye
        ? { filter: 'painted-hair-second', placement: look.hairPlacement ?? 'streak' }
        : undefined,
      eyeFilters: [
        leftEye ? 'painted-eye-left' : undefined,
        rightEye ? 'painted-eye-right' : undefined,
      ],
      garment: naturalOrDyed(
        FITTED_ART_SOURCE[fittedGarments[look.outerwear]],
        'painted-fabric',
        fabricDye,
      ),
      gear:
        look.gear === 'none'
          ? undefined
          : naturalOrDyed(FITTED_ART_SOURCE[fittedGear[look.gear]], 'painted-gear', gearDye),
      gearPlacement: look.gear === 'none' ? undefined : gearPlacement[look.gear],
      facialHair: beard
        ? {
            layer: naturalOrDyed(FITTED_ART_SOURCE[beard], 'painted-beard', beardDye),
            fit:
              look.facialHair === 'moustache'
                ? 'upperLip'
                : look.facialHair === 'goatee'
                  ? 'chin'
                  : 'jaw',
          }
        : undefined,
      headwear: hat
        ? {
            layer: naturalOrDyed(FITTED_ACCESSORY_ART[hat[0]], 'painted-hat', headDye),
            kind: hat[1],
            wideBrim: hatId === 'astronomerhat' || hatId === 'goldwingtricorn',
          }
        : undefined,
      facewear: accessory
        ? {
            layer: naturalOrDyed(
              FITTED_ACCESSORY_ART[accessory[0]],
              'painted-accessory',
              accessoryDye,
            ),
            kind: accessory[1],
          }
        : undefined,
    },
    backdrop,
    icon,
  )
}

const longHair = new Set<PaintedPlayerLook['hairstyle']>([
  'layers',
  'pony',
  'braid',
  'twins',
  'waves',
  'shag',
  'sidefringe',
  'ringlets',
  'curlsweep',
  'razor',
  'curtain',
  'highpony',
  'lowpony',
  'sidepony',
  'fishtail',
  'loosebraid',
  'longbraid',
  'twinloops',
  'twinlow',
  'twinribbons',
  'mermaid',
  'softwave',
  'silkwave',
])

const shoulderLengthLooseHair = new Set<PaintedPlayerLook['hairstyle']>([
  'layers',
  'waves',
  'shag',
  'ringlets',
  'razor',
  'curtain',
  'mermaid',
  'softwave',
  'silkwave',
])

const boundHair = new Set<PaintedPlayerLook['hairstyle']>([
  'bun',
  'topknot',
  'tightbun',
  'loosebun',
  'sidebun',
  'warrior',
  'doublenot',
  'hightwist',
  'coils',
])
const looseWaveHair = new Set<PaintedPlayerLook['hairstyle']>([
  'waves',
  'ringlets',
  'mermaid',
  'softwave',
  'silkwave',
  'longbraid',
  'curlsweep',
])

export function fittedSpriteOutfit(look: PaintedPlayerAppearanceBlueprint) {
  return PAINTED_SPRITE_HEADS[fittedGarments[look.outerwear]].href
}

export function fittedSpriteGear(look: PaintedPlayerAppearanceBlueprint) {
  return look.gear === 'none'
    ? undefined
    : { art: PAINTED_SPRITE_HEADS[fittedGear[look.gear]], placement: gearPlacement[look.gear] }
}

export function fittedSpriteSkinPigment(look: PaintedPlayerAppearanceBlueprint): Pigment {
  const face = FITTED_ART_SOURCE[fittedFace(look).source]
  return (
    WARDROBE_SKIN_TONES[look.skinTone].rgb ??
    ('neckPigments' in face ? face.neckPigments[0] : [170, 119, 85])
  )
}

function luminance([red, green, blue]: Pigment) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function fittedCharacterSpriteHead(
  look: PaintedPlayerAppearanceBlueprint,
  facing: AppearanceFacing,
  id: string,
) {
  const baseFace = fittedFace(look)
  const feminine = look.identity === 'pinescout' || look.identity === 'ranger'
  const rear = facing === 'north'
  const profile = facing === 'east' || facing === 'west'
  const long = longHair.has(look.hairstyle)
  const tied = boundHair.has(look.hairstyle)
  const waves = looseWaveHair.has(look.hairstyle)
  const facingHair = rear
    ? tied
      ? 'bunBackHair'
      : waves
        ? 'longBackHair'
        : long
          ? 'braidBackHair'
          : 'shortBackHair'
    : tied
      ? 'curledSideHair'
      : waves
        ? 'waveSideHair'
        : long
          ? 'longSideHair'
          : 'shortSideHair'
  const facingHairArt = PAINTED_SPRITE_HEADS[facingHair]
  const hairArt = FITTED_ART_SOURCE[FITTED_HAIR_ART[look.hairstyle]]
  const skinColor =
    rear || profile ? fittedSpriteSkinPigment(look) : WARDROBE_SKIN_TONES[look.skinTone].rgb
  const naturalHair = hairArt.hairPigment
  const hairDye = WARDROBE_HAIR_COLORS[look.hairDye].rgb
  const facingPigment = (pigment: Pigment, referenceLuminance: number): Pigment => {
    const ratio = referenceLuminance / Math.max(32, luminance(facingHairArt.hairPigment))
    const remap = (channel: number) => Math.min(255, Math.round(channel * ratio))
    return [remap(pigment[0]), remap(pigment[1]), remap(pigment[2])]
  }
  // A blonde rear painting and a brown front painting need different dye gains
  // to show the same hair color as the character turns.
  const hairColor =
    rear || profile
      ? facingPigment(hairDye ?? naturalHair, hairDye ? luminance(naturalHair) : 140)
      : hairDye
  const chosenAccent = look.hairAccent ? WARDROBE_HAIR_COLORS[look.hairAccent].rgb : null
  const hairAccent =
    chosenAccent && (rear || profile)
      ? facingPigment(chosenAccent, luminance(naturalHair))
      : chosenAccent
  const headColor = WARDROBE_DYES[look.headColor].rgb
  const faceColor = WARDROBE_DYES[look.faceColor].rgb
  const skinId = skinColor ? `${id}-skin` : undefined
  const hairId = hairColor ? `${id}-hair` : undefined
  const accentId = hairAccent ? `${id}-accent` : undefined
  const headColorId = headColor ? `${id}-head-pigment` : undefined
  const faceColorId = faceColor ? `${id}-face-pigment` : undefined
  const image = (
    href: string,
    left: number,
    top: number,
    width: number,
    height: number,
    tint?: string,
  ) =>
    `<image href="${href}" x="${left}" y="${top}" width="${width}" height="${height}" preserveAspectRatio="none"${tint ? ` filter="url(#${tint})"` : ''}/>`
  const registeredImage = (
    source: (typeof PAINTED_SPRITE_HEADS)[SourceName],
    target: PortraitAnchors,
    tint?: string,
  ) => {
    const { origin, scaleX, scaleY } = fitPortraitLayer(source.anchors, target)
    return image(source.href, ...origin, source.width * scaleX, source.height * scaleY, tint)
  }

  const portraitFit = faceLandmarks(baseFace, look.apparentAge === 'youthful')
  const landmarks: PortraitFaceLandmarks = {
    ...portraitFit,
    eyes: profile ? [128, 160] : portraitFit.eyes,
    mouth: profile ? [166, 132] : portraitFit.mouth,
  }
  const skin =
    rear || profile
      ? image(
          PAINTED_SPRITE_HEADS[
            rear ? (feminine ? 'womanBack' : 'manBack') : feminine ? 'womanSide' : 'manSide'
          ].href,
          rear ? 79 : 71,
          31,
          rear ? 98 : 113,
          156,
          skinId,
        )
      : registeredImage(
          PAINTED_SPRITE_HEADS[baseFace.source],
          {
            left: landmarks.eyes[0],
            right: landmarks.eyes[1],
            top: landmarks.eyesY,
            bottom: landmarks.chin,
          },
          skinId,
        )
  const rawHair =
    rear || profile
      ? image(
          facingHairArt.href,
          long ? 50 : 66,
          tied ? 10 : 20,
          long ? 138 : 116,
          long ? 173 : tied ? 134 : 111,
        )
      : registeredImage(
          PAINTED_SPRITE_HEADS[FITTED_HAIR_ART[look.hairstyle]],
          fittedHairTarget(hairArt, landmarks, long ? 'long' : 'short'),
        )
  const colorHair = hairId ? `filter="url(#${hairId})"` : ''
  const accentArea =
    look.hairPlacement === 'split'
      ? '<rect x="128" width="128" height="256"/>'
      : look.hairPlacement === 'streak'
        ? '<path d="M139 0h18l29 256h-18Z"/>'
        : `<rect y="${look.hairPlacement === 'tips' ? (long ? 105 : 58) : 81}" width="256" height="256"/>`
  const hair = accentId
    ? `<defs><g id="${id}-base-hair">${rawHair}</g><clipPath id="${id}-accent-fit">${accentArea}</clipPath></defs>
      <use href="#${id}-base-hair" ${colorHair}/><g clip-path="url(#${id}-accent-fit)"><use href="#${id}-base-hair" filter="url(#${accentId})"/></g>`
    : `<g ${colorHair}>${rawHair}</g>`
  const hatId = replacementHeadwear[look.headwear] ?? look.headwear
  const accessoryId =
    replacementFacewear[look.facewear as keyof typeof replacementFacewear] ?? look.facewear
  const hat = FITTED_HEADWEAR[hatId as keyof typeof FITTED_HEADWEAR]
  const facewear = FITTED_FACEWEAR[accessoryId as keyof typeof FITTED_FACEWEAR]
  const worn = fitPortraitAccessories(
    landmarks,
    hair,
    hat && {
      layer: { ...PAINTED_SPRITE_HEADS[hat[0]], filter: headColorId },
      kind: hat[1],
      wideBrim: hatId === 'astronomerhat' || hatId === 'goldwingtricorn',
    },
    !rear && facewear
      ? { layer: { ...PAINTED_SPRITE_HEADS[facewear[0]], filter: faceColorId }, kind: facewear[1] }
      : undefined,
    id,
  )
  const skinShade = skinColor ? pigmentCss(skinColor, 0.58) : baseFace.skin[1]
  const marks = rear || profile ? '' : fittedFaceMarks(look, landmarks, skinShade)
  const beardName =
    look.facialHair && look.facialHair !== 'none' ? fittedBeards[look.facialHair] : null
  const beardFit =
    look.facialHair === 'moustache' ? 'upperLip' : look.facialHair === 'goatee' ? 'chin' : 'jaw'
  const beardTarget = fittedFacialHairTarget(landmarks, beardFit)
  const beard =
    !rear && beardName
      ? registeredImage(
          PAINTED_SPRITE_HEADS[beardName],
          profile && beardFit === 'jaw' ? { ...beardTarget, left: 118, right: 183 } : beardTarget,
          hairId,
        )
      : ''
  const defs =
    (skinId
      ? calibratedSkinFilter(
          skinId,
          skinColor,
          rear || profile
            ? [170, 119, 85]
            : fittedSpriteSkinPigment({ ...look, skinTone: 'natural' }),
        )
      : '') +
    (hairId ? paintedPigmentFilter(hairId, hairColor) : '') +
    (accentId ? paintedPigmentFilter(accentId, hairAccent) : '') +
    (headColorId ? paintedPigmentFilter(headColorId, headColor) : '') +
    (faceColorId ? paintedPigmentFilter(faceColorId, faceColor) : '')
  const nearFacewear = !profile
    ? worn.accessory
    : `<clipPath id="${id}-near-face"><rect x="130" width="64" height="210"/></clipPath><g clip-path="url(#${id}-near-face)">${worn.accessory}</g>`
  const headScale = 0.079
  const neckCenter = rear || profile ? 128 : (landmarks.neck[0] + landmarks.neck[1]) / 2
  const headX = 24 - headScale * neckCenter
  const headY = PAINTED_SPRITE_COLLAR_Y - headScale * (landmarks.chin + 12)
  return `<g id="${id}"><defs>${defs}</defs><g transform="translate(${headX} ${headY}) scale(${headScale})">${worn.hatBack}${worn.accessoryBack}${skin}${marks}${beard}${worn.fittedHair}${nearFacewear}${worn.hat}</g></g>`
}
