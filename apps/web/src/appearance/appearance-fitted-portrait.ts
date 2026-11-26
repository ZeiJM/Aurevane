import { FITTED_ACCESSORY_ART } from './appearance-fitted-accessories.generated'
import { FITTED_FACEWEAR, FITTED_HEADWEAR } from './appearance-fitted-accessories'
import { FITTED_ART_SOURCE } from './appearance-fitted-source.generated'
import { PAINTED_HAIRLINE_REFITS } from './appearance-hairline-refits.generated'
import type {
  AppearanceExpression,
  AppearanceFacing,
  PaintedPlayerAppearanceBlueprint,
} from './appearance-manifest'
import { paintedPigmentFilter } from './appearance-painted-equipment'
import { PAINTED_SPRITE_HEADS } from './appearance-painted-sprite-heads.generated'
import { PAINTED_SPRITE_OUTFITS } from './appearance-painted-sprite-outfits.generated'
import { fittedSpriteTorsoWidth, PAINTED_SPRITE_COLLAR_Y } from './appearance-painted-sprite-rig'
import {
  WARDROBE_DYES,
  PAINTED_PLAYER_FIELDS,
  WARDROBE_FRAMES,
  WARDROBE_HAIR_COLORS,
  WARDROBE_SKIN_TONES,
  type PaintedPlayerLook,
} from './appearance-painted-wardrobe'
import { PORTRAIT_EXPRESSION_MAPS } from './appearance-portrait-expression-maps.generated'
import { REPAINTED_FACES } from './appearance-repainted-faces.generated'
import { REPAINTED_GARMENTS } from './appearance-repainted-garments.generated'
import { REPAINTED_HAIR } from './appearance-repainted-hair.generated'
import { REPAINTED_OUTFITS } from './appearance-repainted-outfits.generated'
import { FLOWING_HAIR } from './appearance-flowing-hair.generated'
import { TAILORED_HAIR } from './appearance-tailored-hair.generated'
import { TIED_HAIR } from './appearance-tied-hair.generated'
import {
  fitPortraitAccessories,
  fittedFacialHairTarget,
  fittedHairCrownWidth,
  fittedHairTarget,
  fitScalpToHairline,
  fitPortraitLayer,
  PORTRAIT_TEMPLE_FRACTION,
  renderFittedPortrait,
  tuckHairBehindFace,
  type PortraitAnchors,
  type PortraitFaceLandmarks,
} from './appearance-portrait-fit'

type SourceName = keyof typeof FITTED_ART_SOURCE

const wardrobePaintings = {
  ...PAINTED_HAIRLINE_REFITS,
  ...REPAINTED_HAIR,
  ...REPAINTED_GARMENTS,
  ...TAILORED_HAIR,
  ...FLOWING_HAIR,
  ...TIED_HAIR,
}
type RefitArt = typeof wardrobePaintings
const refits: {
  [Name in SourceName]?: Name extends keyof RefitArt ? RefitArt[Name] : never
} = wardrobePaintings

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
type FacePainting = Readonly<{
  href: string
  width: number
  height: number
  anchors: PortraitAnchors
  neckPigments?: readonly [Pigment, Pigment]
  midTone?: Pigment
  facialGuides?: Readonly<{ center: number; nose: number; lip: number }>
  fit?: Readonly<{
    temples: readonly [number, number]
    hairline: number
    brow: number
    neck: readonly [number, number]
    iris: number
  }>
}>

const repaintedFaces: Partial<
  Record<
    string,
    { portrait: FacePainting & Required<Pick<FacePainting, 'neckPigments'>>; sprite: FacePainting }
  >
> = REPAINTED_FACES

function pigmentCss(pigment: readonly number[], shade = 1) {
  return `rgb(${pigment.map((channel) => Math.round(channel * shade)).join(',')})`
}

const skinLuminance = [0.2126, 0.7152, 0.0722] as const

function skinToneTransform(tone: Pigment, midTone: Pigment) {
  const lowLightFill = Math.max(0, 136 - luminance(tone)) * 0.44
  const lightColor = [1.07, 0.94, 0.81] as const
  const ratio = (luminance(tone) + lowLightFill) / Math.max(55, luminance(midTone))
  // Anchor the tint at a painted midtone. Keep some local chroma so lip, cheek
  // and eye colors survive a skin tone change, and ease only the darkest tones.
  const contrast = Math.min(1.08, 0.48 + 0.5 * Math.sqrt(ratio))
  const chroma = 0.44
  const rows = tone.map((channel, index) => {
    const gains = skinLuminance.map(
      (weight, input) => weight * (contrast - chroma) + (index === input ? chroma : 0),
    )
    const reference = gains.reduce((sum, gain, input) => sum + gain * midTone[input]!, 0)
    return { gains, offset: channel + lowLightFill * lightColor[index]! - reference }
  })
  return {
    matrix: rows.flatMap(({ gains, offset }) => [...gains, 0, offset / 255]),
    recolor: (color: Pigment) =>
      rows.map(({ gains, offset }) =>
        Math.min(
          255,
          Math.max(
            0,
            gains.reduce((sum, gain, input) => sum + gain * color[input]!, offset),
          ),
        ),
      ),
  }
}

function calibratedSkinFilter(id: string, tone: Pigment | null, midTone: Pigment) {
  if (!tone) return ''
  const { matrix } = skinToneTransform(tone, midTone)
  return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${matrix.join(' ')} 0 0 0 1 0"/></filter>`
}

const registeredFaces = {
  f01: {
    source: 'river-scholar',
    eyeWidth: 22,
    chin: 157,
    neck: 21,
    skin: ['#b48164', '#744f38'],
  },
  f02: {
    source: 'storm-navigator',
    eyeWidth: 23,
    chin: 158,
    neck: 23,
    skin: ['#a16b43', '#694a38'],
  },
  m01: {
    source: 'night-courier',
    eyeWidth: 23,
    chin: 164,
    neck: 22,
    skin: ['#b0815e', '#7c543c'],
  },
  m02: {
    source: 'bronze-warden',
    eyeWidth: 25,
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
  const repainted = repaintedFaces[id]
  if (repainted) {
    const pigments = repainted.portrait.neckPigments
    return {
      ...repainted,
      eyeWidth: 22,
      chin: 158,
      neck: 21,
      skin: [pigmentCss(pigments[0]), pigmentCss(pigments[1])] as const,
    }
  }
  const authored = registeredFaces[id as keyof typeof registeredFaces]
  if (authored)
    return {
      ...authored,
      portrait: FITTED_ART_SOURCE[authored.source] as FacePainting,
      sprite: PAINTED_SPRITE_HEADS[authored.source],
    }

  const feminine = look.identity === 'pinescout' || look.identity === 'ranger'
  const faceIndex = Number(/^.[0-9]+/.exec(id)?.[0].slice(1) ?? 73 + rigOffsets[look.identity])
  const index = (faceIndex + 25) % 28
  const category =
    index < 12 ? (feminine ? 'adultWomen' : 'adultMen') : feminine ? 'secondWomen' : 'secondMen'
  const source = `${category}-${index < 12 ? index + 1 : index - 11}` as SourceName
  const shape = id.endsWith('soft') ? 1 : id.endsWith('keen') ? -1 : 0
  const seed = faceIndex + rigOffsets[look.identity] + (feminine ? 0 : 71)
  const portrait: FacePainting = FITTED_ART_SOURCE[source]
  const pigments =
    portrait.neckPigments ??
    ([
      [170, 119, 85],
      [120, 76, 57],
    ] as const)
  return {
    portrait,
    sprite: PAINTED_SPRITE_HEADS[source],
    eyeWidth: 20.7 + ((seed * 11) % 29) * 0.15 + shape * 0.6,
    chin: (feminine ? 155 : 159) + ((seed * 17) % 47) * 0.16 - shape * 2.1,
    neck: (feminine ? 20 : 22) + ((seed * 19) % 17) * 0.2,
    skin: [pigmentCss(pigments[0]), pigmentCss(pigments[1])] as const,
  }
}

function faceLandmarks(
  face: ReturnType<typeof fittedFace>,
  youthful = false,
): PortraitFaceLandmarks {
  const source = face.portrait
  const eyesY = 98
  const sourceEyeSpan = source.anchors.right - source.anchors.left
  const sourceJawHeight = source.anchors.bottom - source.anchors.top
  const desiredJawHeight = face.chin - eyesY - (youthful ? 3 : 0)
  // Preserve the painted proportions while keeping the intended face size.
  const scale = Math.sqrt(
    (2 * face.eyeWidth * desiredJawHeight) / (sourceEyeSpan * sourceJawHeight),
  )
  const eyeHalfWidth = (sourceEyeSpan * scale) / 2
  const eyes = [128 - eyeHalfWidth, 128 + eyeHalfWidth] as const
  const chin = eyesY + sourceJawHeight * scale
  const fit = fitPortraitLayer(source.anchors, {
    left: eyes[0],
    right: eyes[1],
    top: eyesY,
    bottom: chin,
  })
  const projectX = (fraction: number) => fit.origin[0] + fraction * source.width * scale
  const projectY = (fraction: number) => fit.origin[1] + fraction * source.height * scale
  const guides = source.facialGuides
  const center = guides ? projectX(guides.center) : 128
  const templeMargin = (source.width * scale * (1 - PORTRAIT_TEMPLE_FRACTION)) / 2
  const templeLeft = source.fit ? projectX(source.fit.temples[0]) : fit.origin[0] + templeMargin
  const templeRight = source.fit
    ? projectX(source.fit.temples[1])
    : fit.origin[0] + source.width * scale - templeMargin
  const neckHalfWidth = Math.min(face.neck, (templeRight - templeLeft) / 4)
  const jawHeight = chin - eyesY
  return {
    eyes,
    eyesY,
    temples: [templeLeft, templeRight],
    hairline: source.fit ? projectY(source.fit.hairline) : eyesY - jawHeight * 0.48,
    brow: source.fit ? projectY(source.fit.brow) : eyesY - jawHeight * 0.14,
    irisRatio: source.fit?.iris,
    nose: guides ? projectY(guides.nose) : 116,
    mouth: guides ? [center, projectY(guides.lip)] : undefined,
    chin,
    neck: source.fit
      ? [projectX(source.fit.neck[0]), projectX(source.fit.neck[1])]
      : [center - neckHalfWidth, center + neckHalfWidth],
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
  const [lipX, lipY] = landmarks.mouth ?? [128, nose + 17]
  const marks = {
    cross: `M${cheekX} ${cheekY}l12 14m0-14-12 14`,
    cheek: `M${cheekX} ${cheekY}q4 8 12 12`,
    brow: `M${eyes[0] - 7} ${eyesY - 17}l7 9`,
    bridge: `M118 ${nose - 3}q9 3 18-3`,
    jaw: `M91 ${chin - 24}q5 8 12 12`,
    cheekpair: `M${eyes[0] - 7} ${nose + 1}q6 7 11 8m-14-3 10 7`,
    lip: `M${lipX + 4} ${lipY - 3}q-4 6-3 13`,
    temple: `M${landmarks.temples[0] + 14} ${eyesY - 11}q1 7 6 12`,
    browarch: `M${eyes[1] - 8} ${eyesY - 13}q8-8 15-6`,
    cheekstar: `M${cheekX + 3} ${cheekY + 3}l7 7m-7 1 8-9m-4-1v10`,
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

const hairRegistrations: Partial<
  Record<PaintedPlayerLook['hairstyle'], readonly [number, number]>
> = {
  layers: [-2, -3],
  sidepart: [0, -2],
  fishtail: [-4, -2],
  loosebraid: [-2, -2],
  sidefringe: [2, -2],
  longbraid: [1, -6],
  coils: [0, -4],
}

const rootsVisible = new Set<PaintedPlayerLook['hairstyle']>([
  'layers',
  'curls',
  'longbraid',
  'braid',
  'loosebraid',
  'fishtail',
  'coils',
  'sidepart',
  'tightbun',
  'crown',
  'waves',
])

const tuckedFringe = new Set<PaintedPlayerLook['hairstyle']>([
  'natural',
  'sidepart',
  'coils',
  'curls',
  'fishtail',
  'twins',
  'sidepony',
  'razor',
  'bun',
  'pony',
  'loosebun',
  'sidebun',
  'hightwist',
  'ropebraid',
])
const repaintedExpressionStrength = { neutral: 0, happy: 22, angry: 18, sad: 21, surprised: 23 }

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
  const faceSource = face.portrait
  const naturalOrDyed = <T>(
    layer: T,
    filter: string,
    pigment: readonly [number, number, number] | null,
  ) => (pigment ? { ...layer, filter } : layer)
  const hairDye = WARDROBE_HAIR_COLORS[look.hairDye].rgb
  const hairName = FITTED_HAIR_ART[look.hairstyle]
  const garmentName = fittedGarments[look.outerwear]
  const newGarment = refits[garmentName]
  const hair = refits[hairName]?.portrait ?? FITTED_ART_SOURCE[hairName]
  const fabricDye = WARDROBE_DYES[look.clothColor].rgb
  const accentDye = look.hairAccent ? WARDROBE_HAIR_COLORS[look.hairAccent].rgb : null
  const highlightDye = look.hairHighlight ? WARDROBE_HAIR_COLORS[look.hairHighlight].rgb : null
  const pattern =
    look.irisPattern === 'central' || look.irisPattern === 'sectoral' ? look.irisPattern : undefined
  const rightEye = PAINTED_PLAYER_FIELDS.eyeColor[look.eyeColor].rgb
  const secondaryEye = PAINTED_PLAYER_FIELDS.secondEye[look.secondEye ?? look.eyeColor].rgb
  const leftEye = pattern ? rightEye : secondaryEye
  const headDye = WARDROBE_DYES[look.headColor].rgb
  const accessoryDye = WARDROBE_DYES[look.faceColor].rgb
  const gearDye = WARDROBE_DYES[look.gearColor].rgb
  const skinDye = WARDROBE_SKIN_TONES[look.skinTone].rgb
  const originalSkin = faceSource.neckPigments?.[0] ?? ([170, 119, 85] as const)
  const originalShadow = faceSource.neckPigments?.[1] ?? ([120, 76, 57] as const)
  const midTone = faceSource.midTone ?? originalSkin
  const skinTransform = skinDye ? skinToneTransform(skinDye, midTone) : null
  const neckPigment = skinTransform
    ? ([
        pigmentCss(skinTransform.recolor(originalSkin)),
        pigmentCss(skinTransform.recolor(originalShadow)),
      ] as const)
    : faceSource.neckPigments
      ? ([pigmentCss(originalSkin), pigmentCss(originalShadow)] as const)
      : face.skin
  const beard =
    look.identity !== 'pinescout' &&
    look.identity !== 'ranger' &&
    look.facialHair &&
    look.facialHair !== 'none'
      ? fittedBeards[look.facialHair]
      : null
  const beardDye = hairDye ?? ('hairPigment' in hair ? hair.hairPigment : null)
  return renderFittedPortrait(
    {
      face: naturalOrDyed(faceSource, 'painted-skin', skinDye),
      trimScalp: Boolean(faceSource.facialGuides),
      landmarks,
      neckPigment,
      faceMarks: fittedFaceMarks(look, landmarks, neckPigment[1]),
      expressionMap: expression !== 'neutral' ? PORTRAIT_EXPRESSION_MAPS[expression] : undefined,
      expressionIntensity: faceSource.fit
        ? repaintedExpressionStrength[expression]
        : expression === 'happy' || expression === 'sad'
          ? 18
          : 16,
      torsoScale: WARDROBE_FRAMES[look.bodyFrame].torsoScale,
      paintedFilters:
        paintedPigmentFilter('painted-hair', hairDye) +
        (beard ? paintedPigmentFilter('painted-beard', beardDye) : '') +
        paintedPigmentFilter('painted-hair-second', accentDye) +
        paintedPigmentFilter('painted-hair-highlight', highlightDye) +
        paintedPigmentFilter('painted-eye-left', leftEye) +
        paintedPigmentFilter('painted-eye-right', rightEye) +
        (pattern ? paintedPigmentFilter('painted-iris-color', secondaryEye) : '') +
        paintedPigmentFilter('painted-fabric', fabricDye) +
        calibratedSkinFilter('painted-skin', skinDye, midTone) +
        paintedPigmentFilter('painted-gear', gearDye) +
        paintedPigmentFilter('painted-hat', headDye) +
        paintedPigmentFilter('painted-accessory', accessoryDye),
      hair: naturalOrDyed(hair, 'painted-hair', hairDye),
      rootedHair: rootsVisible.has(look.hairstyle) || 'hairlineGuide' in hair,
      tuckHairBehindFace: tuckedFringe.has(look.hairstyle) || 'hairlineGuide' in hair,
      hairLength: longHair.has(look.hairstyle) ? 'long' : 'short',
      hairAdjustment: hairRegistrations[look.hairstyle],
      tuckHairBehindShoulders: shoulderLengthLooseHair.has(look.hairstyle),
      hairAccent: accentDye
        ? {
            filter: 'painted-hair-second',
            placement: look.hairPlacement ?? 'streak',
            ...(highlightDye ? { highlight: 'painted-hair-highlight' } : {}),
          }
        : undefined,
      eyeFilters: [
        leftEye ? 'painted-eye-left' : undefined,
        rightEye ? 'painted-eye-right' : undefined,
      ],
      irisAccent: pattern && secondaryEye ? { filter: 'painted-iris-color', pattern } : undefined,
      garment: naturalOrDyed(
        newGarment?.portrait ?? FITTED_ART_SOURCE[garmentName],
        'painted-fabric',
        fabricDye,
      ),
      lowCollar: Boolean(newGarment),
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
])
const looseWaveHair = new Set<PaintedPlayerLook['hairstyle']>([
  'layers',
  'waves',
  'ringlets',
  'mermaid',
  'softwave',
  'silkwave',
  'longbraid',
  'curlsweep',
])

export function fittedSpriteOutfit(look: PaintedPlayerAppearanceBlueprint) {
  const garmentName = fittedGarments[look.outerwear]
  return {
    front: (refits[garmentName]?.sprite ?? PAINTED_SPRITE_HEADS[garmentName]).href,
    ...PAINTED_SPRITE_OUTFITS[look.outerwear],
    ...REPAINTED_OUTFITS[look.outerwear as keyof typeof REPAINTED_OUTFITS],
  }
}

export function fittedSpriteGear(look: PaintedPlayerAppearanceBlueprint) {
  return look.gear === 'none'
    ? undefined
    : { art: PAINTED_SPRITE_HEADS[fittedGear[look.gear]], placement: gearPlacement[look.gear] }
}

export function fittedSpriteSkinPigment(look: PaintedPlayerAppearanceBlueprint): Pigment {
  const face = fittedFace(look).portrait
  return (
    WARDROBE_SKIN_TONES[look.skinTone].rgb ??
    face.midTone ??
    face.neckPigments?.[0] ?? [170, 119, 85]
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
  const hairName = FITTED_HAIR_ART[look.hairstyle]
  const hairRefit = refits[hairName]
  const hairArt = hairRefit?.portrait ?? FITTED_ART_SOURCE[hairName]
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
  const chosenHighlight = look.hairHighlight ? WARDROBE_HAIR_COLORS[look.hairHighlight].rgb : null
  const highlight =
    chosenHighlight && (rear || profile)
      ? facingPigment(chosenHighlight, luminance(naturalHair))
      : chosenHighlight
  const headColor = WARDROBE_DYES[look.headColor].rgb
  const faceColor = WARDROBE_DYES[look.faceColor].rgb
  const skinId = skinColor ? `${id}-skin` : undefined
  const hairId = hairColor ? `${id}-hair` : undefined
  const accentId = hairAccent ? `${id}-accent` : undefined
  const highlightId = highlight ? `${id}-highlight` : undefined
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
    source: { href: string; width: number; height: number; anchors: PortraitAnchors },
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
          baseFace.sprite,
          {
            left: landmarks.eyes[0],
            right: landmarks.eyes[1],
            top: landmarks.eyesY,
            bottom: landmarks.chin,
          },
          skinId,
        )
  // Register a directional painting by the crown. Long styles keep their
  // length behind the neck instead of enlarging the hair around the face.
  const hairWidth = profile ? (long ? 124 : 107) : long ? 128 : 108
  const hairLeft = profile ? (long ? 53 : 65) : long ? 64 : 74
  const hairTarget = fittedHairTarget(
    hairArt,
    landmarks,
    long ? 'long' : 'short',
    hairRegistrations[look.hairstyle],
  )
  const rawHair =
    rear || profile
      ? image(
          facingHairArt.href,
          hairLeft,
          tied ? 19 : 26,
          hairWidth,
          long ? 156 : tied ? 121 : 101,
        )
      : registeredImage(hairRefit?.sprite ?? PAINTED_SPRITE_HEADS[hairName], hairTarget)
  const colorHair = hairId ? `filter="url(#${hairId})"` : ''
  const accentArea =
    look.hairPlacement === 'split'
      ? '<rect x="128" width="128" height="256"/>'
      : look.hairPlacement === 'streak'
        ? '<path d="M139 0h18l29 256h-18Z"/>'
        : look.hairPlacement === 'ribbons'
          ? '<path d="M103 0h14l25 256h-14ZM148 0h11l21 256h-13Z"/>'
          : `<rect y="${look.hairPlacement === 'tips' || look.hairPlacement === 'ombre' ? (long ? 93 : 55) : 81}" width="256" height="256"/>`
  const highlightClip = highlightId
    ? `<clipPath id="${id}-highlight-fit"><path d="M106 0h10l24 256h-12Z"/></clipPath>`
    : ''
  const hair = accentId
    ? `<defs><g id="${id}-base-hair">${rawHair}</g><clipPath id="${id}-accent-fit">${accentArea}</clipPath></defs>
      ${highlightClip}<use href="#${id}-base-hair" ${colorHair}/><g clip-path="url(#${id}-accent-fit)"><use href="#${id}-base-hair" filter="url(#${accentId})"/></g>
      ${highlightId ? `<g clip-path="url(#${id}-highlight-fit)"><use href="#${id}-base-hair" filter="url(#${highlightId})"/></g>` : ''}`
    : `<g ${colorHair}>${rawHair}</g>`
  const hatId = replacementHeadwear[look.headwear] ?? look.headwear
  const accessoryId =
    replacementFacewear[look.facewear as keyof typeof replacementFacewear] ?? look.facewear
  const hat = FITTED_HEADWEAR[hatId as keyof typeof FITTED_HEADWEAR]
  const facewear = FITTED_FACEWEAR[accessoryId as keyof typeof FITTED_FACEWEAR]
  const tuckFringe =
    !rear && !profile && (tuckedFringe.has(look.hairstyle) || 'hairlineGuide' in hairArt)
  const skinSource = `${id}-skin-source`
  const scalp =
    !rear && !profile
      ? fitScalpToHairline(skin, hairArt, hairTarget, landmarks, `${id}-scalp-fit`)
      : skin
  const worn = fitPortraitAccessories(
    landmarks,
    tuckFringe ? tuckHairBehindFace(hair, landmarks, skinSource, `${id}-face-hair-overlap`) : hair,
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
    !feminine && !rear && beardName
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
    (highlightId ? paintedPigmentFilter(highlightId, highlight) : '') +
    (headColorId ? paintedPigmentFilter(headColorId, headColor) : '') +
    (faceColorId ? paintedPigmentFilter(faceColorId, faceColor) : '')
  const nearFacewear = !profile
    ? worn.accessory
    : `<clipPath id="${id}-near-face"><rect x="130" width="64" height="210"/></clipPath><g clip-path="url(#${id}-near-face)">${worn.accessory}</g>`
  const bodyBuild = WARDROBE_FRAMES[look.bodyFrame].torsoScale
  const torsoWidth = fittedSpriteTorsoWidth(facing, bodyBuild) * 1.26
  const faceWidth = profile
    ? 113
    : rear
      ? 98
      : (landmarks.temples[1] - landmarks.temples[0]) / PORTRAIT_TEMPLE_FRACTION
  const crownWidth = profile
    ? Math.max(184, hairLeft + hairWidth) - Math.min(71, hairLeft)
    : rear
      ? hairWidth
      : fittedHairCrownWidth(hairArt, hairTarget)
  const headScale = Math.min(
    profile || rear ? 0.073 : 0.076,
    (torsoWidth * (profile ? 0.55 : 0.39)) / faceWidth,
    (torsoWidth * (profile ? (hat ? 0.49 : 0.53) : 0.42)) / Math.max(faceWidth, crownWidth),
  )
  const neckCenter = rear || profile ? 128 : (landmarks.neck[0] + landmarks.neck[1]) / 2
  const headX = 24 - headScale * neckCenter
  const chin = profile ? 151 : rear ? 155 : landmarks.chin
  const headY = PAINTED_SPRITE_COLLAR_Y - headScale * (chin + (profile ? 10 : 6))
  const transform = `translate(${headX} ${headY}) scale(${headScale})`
  return `<defs>${defs}${tuckFringe ? `<g id="${skinSource}">${scalp}</g>` : ''}</defs>
    <g id="${id}-base" transform="${transform}">${worn.hatBack}${worn.accessoryBack}${tuckFringe ? `<use href="#${skinSource}"/>` : scalp}${marks}</g>
    <g id="${id}" transform="${transform}">${beard}${nearFacewear}${worn.fittedHair}${worn.hat}</g>`
}
