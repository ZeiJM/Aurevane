import { PORTRAIT_FACES } from './appearance-face-catalog'
import {
  PAINTED_PLAYER_FIELDS,
  wardrobeLook,
  type PaintedPlayerLook,
} from './appearance-painted-wardrobe'

export { paintedPlayerAppearanceBlueprint } from './appearance-manifest'
export {
  PAINTED_PLAYER_FIELDS,
  PAINTED_PORTRAIT_SETTINGS,
  type PaintedPlayerLook,
} from './appearance-painted-wardrobe'

export const APPEARANCE_GENDERS = { feminine: 'Female', masculine: 'Male' } as const
export type AppearanceGender = keyof typeof APPEARANCE_GENDERS
type Identity = PaintedPlayerLook['identity']
type Hairstyle = PaintedPlayerLook['hairstyle']

const identitiesByGender = {
  feminine: ['pinescout', 'ranger'],
  masculine: ['scout', 'guard', 'elder'],
} as const satisfies Record<AppearanceGender, readonly Identity[]>

export function paintedIdentitiesForGender(gender: AppearanceGender): readonly Identity[] {
  return identitiesByGender[gender]
}

export function appearanceGenderForIdentity(identity: Identity): AppearanceGender {
  return paintedIdentitiesForGender('feminine').includes(identity) ? 'feminine' : 'masculine'
}

const masculineCuts = new Set<Hairstyle>(['spiked', 'frosted', 'warrior', 'brushed'])
const feminineCuts = new Set<Hairstyle>(['twinloops', 'twinribbons', 'sidebun', 'mermaid'])

export function hairstyleAvailableForGender(style: Hairstyle, gender: AppearanceGender) {
  return !(gender === 'feminine' ? masculineCuts : feminineCuts).has(style)
}

export function canAuthorPlayerLook(look: PaintedPlayerLook) {
  const gender = appearanceGenderForIdentity(look.identity)
  return (
    hairstyleAvailableForGender(look.hairstyle, gender) &&
    (gender === 'masculine' || !look.facialHair || look.facialHair === 'none')
  )
}

export function authoredPlayerLook(look: PaintedPlayerLook): PaintedPlayerLook {
  const gender = appearanceGenderForIdentity(look.identity)
  return {
    ...look,
    hairstyle: hairstyleAvailableForGender(look.hairstyle, gender) ? look.hairstyle : 'natural',
    ...(gender === 'feminine' ? { facialHair: undefined } : {}),
    ...(!look.hairAccent || look.hairAccent === 'natural'
      ? { hairHighlight: undefined, hairPlacement: undefined }
      : {}),
    ...(!look.secondEye || look.secondEye === 'natural' ? { irisPattern: undefined } : {}),
  }
}

export function defaultPaintedLookForGender(gender: AppearanceGender): PaintedPlayerLook {
  return {
    ...wardrobeLook(),
    identity: identitiesByGender[gender][0],
    outerwear: gender === 'feminine' ? 'none' : 'compass',
    backdrop: gender === 'feminine' ? 'original' : 'frost',
  }
}

export function paintedPlayerLook(parts: Omit<PaintedPlayerLook, 'backdrop'>): PaintedPlayerLook {
  return { ...parts, backdrop: 'original' }
}

type Dye = PaintedPlayerLook['clothColor']
type CuratedPalette = readonly [
  name: string,
  cloth: Dye,
  accents: Dye,
  backdrop: PaintedPlayerLook['backdrop'],
]
type Ensemble = Readonly<{
  outerwear: PaintedPlayerLook['outerwear']
  gear: PaintedPlayerLook['gear']
  headwear: PaintedPlayerLook['headwear']
  facewear: PaintedPlayerLook['facewear']
  hairstyle: PaintedPlayerLook['hairstyle']
  palettes: readonly [CuratedPalette, CuratedPalette]
}>

const ensembles: readonly Ensemble[] = [
  {
    outerwear: 'compass',
    gear: 'mapcase',
    headwear: 'none',
    facewear: 'none',
    hairstyle: 'natural',
    palettes: [
      ['Deepwater Cartographer', 'midnight', 'ochre', 'hollow'],
      ['Hearth Cartographer', 'oxblood', 'leather', 'crownroad'],
    ],
  },
  {
    outerwear: 'pine',
    gear: 'journal',
    headwear: 'none',
    facewear: 'none',
    hairstyle: 'braid',
    palettes: [
      ['Cedar Pathfinder', 'cedar', 'walnut', 'verdant'],
      ['Alder Pathfinder', 'ochre', 'olive', 'gildroot'],
    ],
  },
  {
    outerwear: 'hawkmantle',
    gear: 'sword',
    headwear: 'none',
    facewear: 'none',
    hairstyle: 'quiff',
    palettes: [
      ['Garnet Hawk', 'garnet', 'walnut', 'ember'],
      ['Storm Hawk', 'denim', 'ochre', 'starfall'],
    ],
  },
  {
    outerwear: 'shearling',
    gear: 'bedroll',
    headwear: 'furcap',
    facewear: 'none',
    hairstyle: 'natural',
    palettes: [
      ['Frostwarden', 'glacier', 'pewter', 'frost'],
      ['Autumn Outrider', 'rust', 'leather', 'northernpass'],
    ],
  },
  {
    outerwear: 'scarf',
    gear: 'rope',
    headwear: 'bandana',
    facewear: 'none',
    hairstyle: 'pony',
    palettes: [
      ['Lagoon Runner', 'lagoon', 'walnut', 'asterwake'],
      ['Dune Runner', 'straw', 'ochre', 'glasswind'],
    ],
  },
  {
    outerwear: 'brigandine',
    gear: 'sword',
    headwear: 'none',
    facewear: 'eyepatch',
    hairstyle: 'natural',
    palettes: [
      ['Ashguard', 'pewter', 'ink', 'steps'],
      ['Ironwood Guard', 'walnut', 'gold', 'crown'],
    ],
  },
  {
    outerwear: 'brocade',
    gear: 'girdle',
    headwear: 'circlet',
    facewear: 'none',
    hairstyle: 'bun',
    palettes: [
      ['Amethyst Archivist', 'plum', 'gold', 'lunar'],
      ['Verdigris Archivist', 'teal', 'pewter', 'archive'],
    ],
  },
  {
    outerwear: 'hooded',
    gear: 'potions',
    headwear: 'none',
    facewear: 'veil',
    hairstyle: 'natural',
    palettes: [
      ['Moss Apothecary', 'moss', 'linen', 'umbral'],
      ['Rosewood Apothecary', 'wine', 'shell', 'orchard'],
    ],
  },
  {
    outerwear: 'quilted',
    gear: 'utility',
    headwear: 'none',
    facewear: 'goggles',
    hairstyle: 'curls',
    palettes: [
      ['Copper Mechanic', 'clay', 'ochre', 'lanternhall'],
      ['Pewter Mechanic', 'pewter', 'walnut', 'starvault'],
    ],
  },
  {
    outerwear: 'none',
    gear: 'bedroll',
    headwear: 'bandana',
    facewear: 'none',
    hairstyle: 'layers',
    palettes: [
      ['Evening Wanderer', 'natural', 'midnight', 'wayfarergate'],
      ['Harvest Wanderer', 'natural', 'straw', 'caravan'],
    ],
  },
  {
    outerwear: 'brocade',
    gear: 'journal',
    headwear: 'arcanist',
    facewear: 'none',
    hairstyle: 'natural',
    palettes: [
      ['Dusk Arcanist', 'ink', 'violet', 'astral'],
      ['Dawn Arcanist', 'ivory', 'amber', 'nebula'],
    ],
  },
  {
    outerwear: 'pine',
    gear: 'mapcase',
    headwear: 'circlet',
    facewear: 'none',
    hairstyle: 'waves',
    palettes: [
      ['Fern Envoy', 'fern', 'gold', 'haven'],
      ['Winter Envoy', 'rain', 'silver', 'silverlake'],
    ],
  },
]

export const CURATED_PAINTED_LOOKS = Object.freeze(
  (Object.keys(PAINTED_PLAYER_FIELDS.identity) as Identity[]).flatMap((identity) => {
    const gender = appearanceGenderForIdentity(identity)
    return ensembles.flatMap(({ palettes, ...parts }) =>
      palettes.map(([name, clothColor, accent, backdrop]) => ({
        name,
        gender,
        look: Object.freeze({
          ...defaultPaintedLookForGender(gender),
          ...parts,
          identity,
          clothColor,
          backdrop,
          gearColor: parts.gear === 'none' ? 'natural' : accent,
          headColor: parts.headwear === 'none' ? 'natural' : accent,
          faceColor: parts.facewear === 'none' ? 'natural' : accent,
        }) satisfies PaintedPlayerLook,
      })),
    )
  }),
)

const capCuts = [
  'crop',
  'sidepart',
  'brushed',
  'crown',
  'tightbun',
  'twinlow',
] as const satisfies readonly Hairstyle[]

const lensCuts = ['crop', 'sidepart', 'brushed', 'crown'] as const satisfies readonly Hairstyle[]

const visibleBrowCuts = [
  'crop',
  'sidepart',
  'brushed',
  'crown',
  'bun',
  'coronet',
  'halo',
  'tightbun',
  'loosebun',
  'braid',
  'fishtail',
  'lowpony',
  'twinlow',
] as const satisfies readonly Hairstyle[]

const rollStudios = {
  none: 'parchment',
  compass: 'tealstudio',
  pine: 'pinegreen',
  hawkmantle: 'amberstudio',
  shearling: 'pearl',
  scarf: 'terracotta',
  brigandine: 'midnight',
  brocade: 'plumstudio',
  hooded: 'garnetstudio',
  quilted: 'amberstudio',
} as const satisfies Record<PaintedPlayerLook['outerwear'], PaintedPlayerLook['backdrop']>

const restrainedHairPairs = [
  ['espresso', 'silver'],
  ['chestnut', 'copper'],
  ['auburn', 'honey'],
  ['onyx', 'ash'],
] as const satisfies readonly (readonly [
  PaintedPlayerLook['hairDye'],
  PaintedPlayerLook['hairDye'],
])[]

export function randomPaintedLookForGender(
  gender: AppearanceGender,
  random = Math.random,
  current?: PaintedPlayerLook,
): PaintedPlayerLook {
  const faces = PORTRAIT_FACES.filter(
    (face) => appearanceGenderForIdentity(face.rig) === gender && face.id !== current?.faceId,
  )
  const choose = <T>(choices: readonly T[]) =>
    choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]!
  const face = choose(faces)
  const ensemble = choose(ensembles)
  const [, paletteColor, accent, setting] = choose(ensemble.palettes)
  const headwear = random() < 0.62 ? ensemble.headwear : 'none'
  // A roll starts with a readable expression; broad eye and mouth coverings
  // remain available in the editor for intentional designs.
  const facewear = ensemble.facewear === 'goggles' && random() < 0.55 ? 'moonsteellenses' : 'none'
  const gear = random() < 0.7 ? ensemble.gear : 'none'
  const cuts =
    facewear !== 'none'
      ? lensCuts
      : headwear === 'circlet'
        ? visibleBrowCuts
        : headwear !== 'none'
          ? capCuts
          : (Object.keys(PAINTED_PLAYER_FIELDS.hairstyle) as Hairstyle[])
  const eligibleCuts = cuts.filter((cut) => hairstyleAvailableForGender(cut, gender))
  const preferred = eligibleCuts.some((cut) => cut === ensemble.hairstyle)
  const hairstyle = random() < 0.48 && preferred ? ensemble.hairstyle : choose(eligibleCuts)
  const faceIsUnframed = headwear === 'none' && facewear === 'none'
  const twoTone = faceIsUnframed && random() < 0.15 ? choose(restrainedHairPairs) : undefined
  const hairDye =
    twoTone?.[0] ??
    choose([
      'natural',
      'natural',
      'natural',
      'espresso',
      'chestnut',
      'auburn',
      'ash',
      'onyx',
      'silver',
      'honey',
    ] as const)
  const eyeColor = choose([
    'natural',
    'natural',
    'hazel',
    'brown',
    'gray',
    'green',
    'blue',
  ] as const)
  return {
    ...defaultPaintedLookForGender(gender),
    identity: face.rig,
    faceId: face.id,
    hairstyle,
    ...(twoTone
      ? {
          hairAccent: twoTone[1],
          hairPlacement: choose(['streak', 'ombre', 'ribbons', 'tips'] as const),
          ...(random() < 0.22
            ? { hairHighlight: choose(['honey', 'silver', 'platinum', 'rosewood'] as const) }
            : {}),
        }
      : {}),
    ...(faceIsUnframed && random() < 0.1
      ? {
          secondEye: choose(
            (
              ['amber', 'green', 'blue', 'violet', 'jade', 'cobalt', 'rose', 'gold'] as const
            ).filter((color) => color !== eyeColor),
          ),
          irisPattern: choose(['paired', 'paired', 'central', 'sectoral'] as const),
        }
      : {}),
    ...(faceIsUnframed && !twoTone && random() < 0.12
      ? {
          scar: choose([
            'cross',
            'cheek',
            'brow',
            'jaw',
            'cheekpair',
            'lip',
            'temple',
            'browarch',
            'cheekstar',
          ] as const),
        }
      : {}),
    ...(gender === 'masculine' && faceIsUnframed && random() < 0.25
      ? { facialHair: choose(['moustache', 'goatee'] as const) }
      : {}),
    clothColor: random() < 0.57 ? 'natural' : paletteColor,
    backdrop: random() < 0.78 ? rollStudios[ensemble.outerwear] : setting,
    outerwear: ensemble.outerwear,
    gear,
    headwear,
    facewear,
    bodyFrame: choose(['natural', 'strong', 'broad', 'stocky', 'slight'] as const),
    hairDye,
    eyeColor,
    gearColor: gear === 'none' || random() < 0.7 ? 'natural' : accent,
    headColor: 'natural',
    faceColor: 'natural',
  }
}
