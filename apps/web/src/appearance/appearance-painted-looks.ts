import { PATTERNED_BACKDROPS } from './appearance-backdrop-catalog'
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
  const [, clothColor, accent, backdrop] = choose(ensemble.palettes)
  const setting =
    random() < 0.16
      ? choose(Object.keys(PATTERNED_BACKDROPS) as (keyof typeof PATTERNED_BACKDROPS)[])
      : backdrop
  const hairstyle =
    random() < 0.55
      ? ensemble.hairstyle
      : choose(Object.keys(PAINTED_PLAYER_FIELDS.hairstyle) as PaintedPlayerLook['hairstyle'][])
  const secondary =
    random() < 0.12 ? choose(['silver', 'lilac', 'copper', 'teal'] as const) : undefined
  return {
    ...defaultPaintedLookForGender(gender),
    identity: face.rig,
    faceId: face.id,
    hairstyle,
    ...(secondary
      ? { hairAccent: secondary, hairPlacement: choose(['tips', 'streak', 'underlight'] as const) }
      : {}),
    ...(random() < 0.1 ? { secondEye: choose(['amber', 'green', 'blue', 'violet'] as const) } : {}),
    ...(random() < 0.12 ? { scar: choose(['cross', 'cheek', 'brow', 'jaw'] as const) } : {}),
    ...(gender === 'masculine' && random() < 0.25
      ? { facialHair: choose(['stubble', 'goatee', 'anchor', 'boxed', 'full'] as const) }
      : {}),
    clothColor,
    backdrop: setting,
    outerwear: ensemble.outerwear,
    gear: ensemble.gear,
    headwear: ensemble.headwear,
    facewear: ensemble.facewear,
    bodyFrame: choose(
      ['natural', 'strong', 'broad', 'stocky', 'slight'].filter(
        (id) => id in PAINTED_PLAYER_FIELDS.bodyFrame,
      ),
    ) as PaintedPlayerLook['bodyFrame'],
    hairDye: choose([
      'natural',
      'natural',
      'chestnut',
      'espresso',
      'auburn',
      'ash',
      'onyx',
      'silver',
      'honey',
    ]),
    eyeColor: choose(['natural', 'natural', 'hazel', 'brown', 'gray', 'green', 'blue']),
    gearColor: ensemble.gear === 'none' ? 'natural' : accent,
    headColor:
      ensemble.headwear === 'none' ? 'natural' : choose(['natural', 'walnut', 'leather', accent]),
    faceColor: ensemble.facewear === 'none' ? 'natural' : choose(['natural', 'leather', 'ink']),
  }
}
