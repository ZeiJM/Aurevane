import { portraitFace } from './appearance-face-catalog'
import { PAINTED_FACEWEAR_STYLES, PAINTED_HEADWEAR_STYLES } from './appearance-fitted-accessories'
import {
  DEFAULT_PAINTED_LOOK,
  PAINTED_ACCESSORIES,
  PAINTED_CLOTHING,
  PAINTED_COLORS,
  PAINTED_FIELDS,
  type PaintedLook,
} from './appearance-painted-catalog'
import { APPEARANCE_BACKDROPS } from './appearance-backdrop-catalog'

export const WARDROBE_DYES = {
  ...PAINTED_COLORS,
  ink: { label: 'Lampblack', rgb: [46, 46, 54] },
  pewter: { label: 'Pewter', rgb: [119, 127, 135] },
  silver: { label: 'Silver', rgb: [181, 188, 198] },
  linen: { label: 'Undyed linen', rgb: [207, 192, 166] },
  cream: { label: 'Cream', rgb: [237, 215, 162] },
  straw: { label: 'Harvest straw', rgb: [204, 175, 109] },
  clay: { label: 'Red clay', rgb: [160, 85, 59] },
  rust: { label: 'Rust', rgb: [176, 70, 44] },
  leather: { label: 'Chestnut leather', rgb: [113, 77, 54] },
  walnut: { label: 'Black walnut', rgb: [81, 59, 49] },
  oxblood: { label: 'Oxblood', rgb: [111, 41, 49] },
  wine: { label: 'Winter wine', rgb: [128, 55, 95] },
  violet: { label: 'Violet', rgb: [124, 100, 176] },
  lilac: { label: 'Lilac smoke', rgb: [164, 146, 198] },
  midnight: { label: 'Midnight', rgb: [36, 54, 96] },
  denim: { label: 'Woad cloth', rgb: [70, 108, 163] },
  rain: { label: 'Rain blue', rgb: [105, 146, 174] },
  glacier: { label: 'Glacier', rgb: [147, 199, 206] },
  lagoon: { label: 'Lagoon', rgb: [38, 102, 116] },
  mint: { label: 'Woodmint', rgb: [106, 170, 139] },
  cedar: { label: 'Cedar', rgb: [43, 87, 69] },
  olive: { label: 'Olive', rgb: [115, 126, 65] },
  fern: { label: 'Fern', rgb: [72, 145, 85] },
  moss: { label: 'Deep moss', rgb: [84, 99, 57] },
  gold: { label: 'Antique gold', rgb: [186, 143, 50] },
  buttercup: { label: 'Buttercup', rgb: [230, 195, 92] },
  coral: { label: 'Coral', rgb: [225, 125, 104] },
  shell: { label: 'Shell pink', rgb: [218, 169, 159] },
  garnet: { label: 'Garnet', rgb: [142, 38, 64] },
  carmine: { label: 'Carmine', rgb: [206, 70, 88] },
} as const

export const WARDROBE_OUTERWEAR = {
  ...PAINTED_CLOTHING,
  brigandine: 'Brigandine armor',
  brocade: 'Brocade scholar vest',
  hooded: 'Hooded travel mantle',
  quilted: 'Quilted rider jacket',
} as const

export const WARDROBE_GEAR = {
  ...PAINTED_ACCESSORIES,
  journal: 'Field journal and lantern',
  rope: 'Hunter’s rope sash',
  sword: 'Scabbard belt',
  girdle: 'Archivist’s girdle',
} as const

const WARDROBE_HEADWEAR = {
  ...PAINTED_FIELDS.headwear,
  furcap: 'Fur-lined trapper cap',
  circlet: 'Leafwork circlet',
} as const

const WARDROBE_FACEWEAR = {
  ...PAINTED_FIELDS.facewear,
  veil: 'Embroidered veil',
  mask: 'Bronze half-mask',
} as const

export const WARDROBE_FRAMES = {
  natural: { label: 'Original build', torsoScale: 1 },
  slight: { label: 'Slender', torsoScale: 0.84 },
  lean: { label: 'Lean', torsoScale: 0.92 },
  strong: { label: 'Athletic', torsoScale: 1.08 },
  broad: { label: 'Broad', torsoScale: 1.16 },
  stocky: { label: 'Stocky', torsoScale: 1.23 },
} as const

export const WARDROBE_SKIN_TONES = {
  natural: { label: 'Original tone', rgb: null },
  alabaster: { label: 'Alabaster', rgb: [239, 199, 176] },
  porcelain: { label: 'Porcelain', rgb: [231, 180, 164] },
  peach: { label: 'Peach', rgb: [221, 168, 133] },
  sand: { label: 'Sand', rgb: [199, 150, 112] },
  olive: { label: 'Golden olive', rgb: [175, 139, 96] },
  bronze: { label: 'Bronze', rgb: [172, 118, 79] },
  honey: { label: 'Honey brown', rgb: [157, 105, 69] },
  copper: { label: 'Copper brown', rgb: [144, 88, 61] },
  umber: { label: 'Umber', rgb: [121, 83, 69] },
  mahogany: { label: 'Mahogany', rgb: [110, 68, 57] },
  cacao: { label: 'Cacao', rgb: [86, 56, 47] },
  espresso: { label: 'Espresso', rgb: [67, 45, 40] },
} as const

export const WARDROBE_HAIRSTYLES = {
  natural: 'Original hairstyle',
  feather: 'Feathered fringe',
  quiff: 'Swept quiff',
  curls: 'Soft curls',
  crown: 'Crown braid',
  layers: 'Layered locks',
  bun: 'Low bun',
  topknot: 'High topknot',
  pony: 'Wrapped ponytail',
  braid: 'Shoulder braid',
  twins: 'Twin braids',
  waves: 'Long waves',
} as const

const extraHairstyles = {
  crop: 'Close crop',
  sidepart: 'Clean side part',
  pixie: 'Layered pixie',
  shag: 'Windblown shag',
  sidefringe: 'Side fringe',
  spiked: 'Blade spikes',
  frosted: 'High swept pompadour',
  brushed: 'Brushed-back quiff',
  loosequiff: 'Loose quiff',
  coils: 'Tight coils',
  ringlets: 'Shoulder ringlets',
  curlsweep: 'Swept curls',
  coronet: 'Braided coronet',
  halo: 'Double crown braid',
  ropebraid: 'Rope crown braid',
  razor: 'Razor layers',
  curtain: 'Curtain layers',
  pageboy: 'Pageboy',
  tightbun: 'Sleek low bun',
  loosebun: 'Loose low bun',
  sidebun: 'Side bun',
  warrior: 'Warrior knot',
  doublenot: 'Twin knots',
  hightwist: 'High twist',
  highpony: 'High ponytail',
  lowpony: 'Low ponytail',
  sidepony: 'Side ponytail',
  fishtail: 'Fishtail braid',
  loosebraid: 'Loose shoulder braid',
  longbraid: 'Long braid',
  twinloops: 'Twin braid loops',
  twinlow: 'Low twin braids',
  twinribbons: 'Ribbon twin braids',
  mermaid: 'Long flowing waves',
  softwave: 'Soft waves',
  silkwave: 'Silken long waves',
} as const

export const PLAYER_HAIRSTYLES = { ...WARDROBE_HAIRSTYLES, ...extraHairstyles } as const

export const PLAYER_HAIRSTYLE_GROUPS = {
  'Short cuts and fringes': [
    'natural',
    'crop',
    'sidepart',
    'pixie',
    'feather',
    'shag',
    'sidefringe',
    'spiked',
    'quiff',
    'frosted',
    'brushed',
    'loosequiff',
  ],
  'Curls, layers and waves': [
    'curls',
    'coils',
    'ringlets',
    'curlsweep',
    'layers',
    'razor',
    'curtain',
    'pageboy',
    'waves',
    'mermaid',
    'softwave',
    'silkwave',
  ],
  Braids: [
    'crown',
    'coronet',
    'halo',
    'ropebraid',
    'braid',
    'fishtail',
    'loosebraid',
    'longbraid',
    'twins',
    'twinloops',
    'twinlow',
    'twinribbons',
  ],
  'Buns, knots and ponytails': [
    'bun',
    'tightbun',
    'loosebun',
    'sidebun',
    'topknot',
    'warrior',
    'doublenot',
    'hightwist',
    'pony',
    'highpony',
    'lowpony',
    'sidepony',
  ],
} as const satisfies Record<string, readonly (keyof typeof PLAYER_HAIRSTYLES)[]>

export const FACIAL_HAIR_STYLES = {
  none: 'Clean-shaven',
  stubble: 'Short stubble',
  moustache: 'Styled moustache',
  goatee: 'Pointed goatee',
  boxed: 'Short boxed beard',
  anchor: 'Anchor beard',
  full: 'Full beard',
  braided: 'Braided beard',
} as const

export const WARDROBE_HAIR_COLORS = {
  natural: { label: 'Original hair color', rgb: null },
  onyx: { label: 'Soft black', rgb: [58, 52, 55] },
  charcoal: { label: 'Blue-black', rgb: [53, 62, 79] },
  espresso: { label: 'Espresso', rgb: [71, 49, 41] },
  walnut: { label: 'Dark walnut', rgb: [91, 68, 54] },
  chestnut: { label: 'Chestnut', rgb: [118, 75, 53] },
  copper: { label: 'Polished copper', rgb: [183, 103, 59] },
  auburn: { label: 'Auburn', rgb: [152, 75, 50] },
  ginger: { label: 'Golden ginger', rgb: [201, 124, 75] },
  rosewood: { label: 'Rosewood', rgb: [128, 77, 76] },
  honey: { label: 'Honey blond', rgb: [176, 137, 80] },
  ash: { label: 'Ash blond', rgb: [177, 161, 135] },
  flax: { label: 'Flax blond', rgb: [205, 181, 122] },
  silver: { label: 'Moon silver', rgb: [181, 182, 192] },
  platinum: { label: 'Ivory platinum', rgb: [219, 212, 195] },
  plum: { label: 'Black plum', rgb: [96, 67, 108] },
  wine: { label: 'Mulled wine', rgb: [119, 54, 77] },
  lilac: { label: 'Dusty lilac', rgb: [154, 123, 171] },
  ocean: { label: 'Storm blue', rgb: [72, 106, 153] },
  teal: { label: 'Sea glass', rgb: [75, 118, 109] },
  moss: { label: 'Forest green', rgb: [83, 113, 71] },
} as const

export const WARDROBE_EYE_COLORS = {
  natural: { label: 'Original eye color', rgb: null },
  brown: { label: 'Warm brown', rgb: [134, 84, 50] },
  amber: { label: 'Amber', rgb: [181, 125, 53] },
  hazel: { label: 'Hazel', rgb: [140, 132, 74] },
  green: { label: 'Moss green', rgb: [82, 132, 84] },
  blue: { label: 'Glacier blue', rgb: [82, 133, 174] },
  gray: { label: 'Storm gray', rgb: [131, 147, 156] },
  violet: { label: 'Violet', rgb: [132, 99, 168] },
} as const

export const PAINTED_WARDROBE_FIELDS = {
  ...PAINTED_FIELDS,
  outerwear: WARDROBE_OUTERWEAR,
  clothColor: WARDROBE_DYES,
  gear: WARDROBE_GEAR,
  gearColor: WARDROBE_DYES,
  headwear: WARDROBE_HEADWEAR,
  headColor: WARDROBE_DYES,
  facewear: WARDROBE_FACEWEAR,
  faceColor: WARDROBE_DYES,
  bodyFrame: WARDROBE_FRAMES,
  skinTone: WARDROBE_SKIN_TONES,
  hairstyle: WARDROBE_HAIRSTYLES,
  hairDye: WARDROBE_HAIR_COLORS,
  eyeColor: WARDROBE_EYE_COLORS,
} as const

export type PaintedWardrobeLook = Readonly<{
  [Field in keyof typeof PAINTED_WARDROBE_FIELDS]: keyof (typeof PAINTED_WARDROBE_FIELDS)[Field]
}>

export const PAINTED_PORTRAIT_SETTINGS = {
  original: 'Original studio',
  ...APPEARANCE_BACKDROPS,
} as const

export const HAIR_COLOR_PLACEMENTS = {
  streak: 'Face-framing streak',
  tips: 'Dip-dyed tips',
  split: 'Split dye',
  underlight: 'Underlights',
} as const

export const FACIAL_SCARS = {
  none: 'None',
  cross: 'Cross-shaped cheek scar',
  cheek: 'Diagonal cheek scar',
  brow: 'Split eyebrow',
  bridge: 'Nose bridge scar',
  jaw: 'Jawline scar',
} as const

export const APPEARANCE_AGES = {
  youthful: 'Youthful adult',
  adult: 'Adult',
  mature: 'Middle-aged',
  elder: 'Elder',
} as const

const optionalPlayerFields = {
  facialHair: [FACIAL_HAIR_STYLES, 'beard', 'none'],
  hairAccent: [WARDROBE_HAIR_COLORS, 'accent', 'natural'],
  hairPlacement: [HAIR_COLOR_PLACEMENTS, 'dye', 'streak'],
  secondEye: [WARDROBE_EYE_COLORS, 'eye', 'natural'],
  scar: [FACIAL_SCARS, 'scar', 'none'],
  apparentAge: [APPEARANCE_AGES, 'age', 'adult'],
} as const

export const PLAYER_APPEARANCE_DETAILS = Object.keys(
  optionalPlayerFields,
) as (keyof typeof optionalPlayerFields)[]

export const PAINTED_PLAYER_FIELDS = {
  ...PAINTED_WARDROBE_FIELDS,
  identity: { pinescout: 'Pine Scout', ...PAINTED_FIELDS.identity },
  headwear: { ...WARDROBE_HEADWEAR, ...PAINTED_HEADWEAR_STYLES },
  facewear: { ...WARDROBE_FACEWEAR, ...PAINTED_FACEWEAR_STYLES },
  hairstyle: PLAYER_HAIRSTYLES,
  facialHair: FACIAL_HAIR_STYLES,
  hairAccent: WARDROBE_HAIR_COLORS,
  hairPlacement: HAIR_COLOR_PLACEMENTS,
  secondEye: WARDROBE_EYE_COLORS,
  scar: FACIAL_SCARS,
  apparentAge: APPEARANCE_AGES,
  backdrop: PAINTED_PORTRAIT_SETTINGS,
} as const

export type PaintedPlayerLook = Readonly<{
  [
    Field in Exclude<keyof typeof PAINTED_PLAYER_FIELDS, keyof typeof optionalPlayerFields>
  ]: keyof (typeof PAINTED_PLAYER_FIELDS)[Field]
}> & {
  readonly faceId?: string
} & Readonly<{
    [Field in keyof typeof optionalPlayerFields]?: keyof (typeof optionalPlayerFields)[Field][0]
  }>

type PaintedWardrobeParts = Omit<PaintedPlayerLook, 'backdrop'>

export const PAINTED_WARDROBE_LABELS = {
  identity: 'Character',
  outerwear: 'Clothing style',
  clothColor: 'Clothing color',
  gear: 'Accessory style',
  gearColor: 'Accessory color',
  headwear: 'Headwear style',
  headColor: 'Headwear color',
  facewear: 'Face accessory style',
  faceColor: 'Face accessory color',
  bodyFrame: 'Body build',
  skinTone: 'Skin tone',
  hairstyle: 'Hairstyle',
  hairDye: 'Hair color',
  facialHair: 'Facial hair',
  hairAccent: 'Second hair color',
  hairPlacement: 'Two-tone placement',
  secondEye: 'Right eye color',
  scar: 'Facial scar',
  apparentAge: 'Apparent age',
  eyeColor: 'Eye color',
} satisfies Record<keyof PaintedWardrobeLook | keyof typeof optionalPlayerFields, string>

export const originalWardrobeFeatures = {
  hairstyle: 'natural',
  hairDye: 'natural',
  eyeColor: 'natural',
} as const

export function wardrobeLook(look: PaintedLook = DEFAULT_PAINTED_LOOK): PaintedWardrobeLook {
  return { bodyFrame: 'natural', skinTone: 'natural', ...originalWardrobeFeatures, ...look }
}

export function wardrobeRecipe(look: PaintedWardrobeParts) {
  const features = [look.hairstyle, look.hairDye, look.eyeColor] as const
  return [
    look.identity,
    look.outerwear,
    look.outerwear === 'none' ? 'natural' : look.clothColor,
    look.gear,
    look.gear === 'none' ? 'natural' : look.gearColor,
    look.headwear,
    look.headwear === 'none' ? 'natural' : look.headColor,
    look.facewear,
    look.facewear === 'none' ? 'natural' : look.faceColor,
    look.bodyFrame,
    look.skinTone,
    ...(features.some((feature) => feature !== 'natural') ? features : []),
  ] as const
}

export function paintedPlayerRecipe(look: PaintedPlayerLook) {
  const [identity, ...parts] = wardrobeRecipe(look)
  return [look.faceId ?? identity, ...parts, ...paintedDetailRecipe(look), look.backdrop] as const
}

export function paintedDetailRecipe(values: Record<string, unknown>) {
  return PLAYER_APPEARANCE_DETAILS.flatMap((field) => {
    const [, marker, fallback] = optionalPlayerFields[field]
    const value = values[field]
    if (value === undefined || value === fallback) return []
    return [typeof value === 'string' ? `${marker}-${value}` : marker + '-invalid']
  })
}

const wardrobeFields = Object.keys(PAINTED_WARDROBE_FIELDS) as (keyof PaintedWardrobeLook)[]
const originalFieldCount = wardrobeFields.length - Object.keys(originalWardrobeFeatures).length

function readLook(
  values: readonly unknown[],
  catalog: typeof PAINTED_WARDROBE_FIELDS | typeof PAINTED_PLAYER_FIELDS,
): PaintedWardrobeParts | null {
  if (values.length !== originalFieldCount && values.length !== wardrobeFields.length) return null
  const fields = wardrobeFields.slice(0, values.length)
  for (const [index, field] of fields.entries()) {
    const value = values[index]
    if (typeof value !== 'string' || !Object.hasOwn(catalog[field], value)) return null
  }
  const look = {
    ...originalWardrobeFeatures,
    ...Object.fromEntries(fields.map((field, index) => [field, values[index]])),
  } as PaintedWardrobeParts
  const recipe = wardrobeRecipe(look)
  return recipe.length === values.length && recipe.every((value, index) => value === values[index])
    ? look
    : null
}

export function readWardrobeLook(values: readonly unknown[]): PaintedWardrobeLook | null {
  const look = readLook(values, PAINTED_WARDROBE_FIELDS)
  return look as PaintedWardrobeLook | null
}

export function readPaintedPlayerLook(values: readonly unknown[]): PaintedPlayerLook | null {
  const backdrop = values.at(-1)
  if (typeof backdrop !== 'string' || !Object.hasOwn(PAINTED_PORTRAIT_SETTINGS, backdrop))
    return null
  const face = portraitFace(values[0])
  let end = values.length - 1
  const details: Record<string, string> = {}
  for (const field of [...PLAYER_APPEARANCE_DETAILS].reverse()) {
    const [options, marker, fallback] = optionalPlayerFields[field]
    const part = values[end - 1]
    if (typeof part !== 'string' || !part.startsWith(marker + '-')) continue
    const selected = part.slice(marker.length + 1)
    if (!Object.hasOwn(options, selected) || selected === fallback) return null
    details[field] = selected
    end--
  }
  const parts = readLook([face?.rig ?? values[0], ...values.slice(1, end)], PAINTED_PLAYER_FIELDS)
  return parts
    ? {
        ...parts,
        ...(face ? { faceId: face.id } : {}),
        ...details,
        backdrop: backdrop as PaintedPlayerLook['backdrop'],
      }
    : null
}

export function randomWardrobeLook(): PaintedWardrobeLook {
  const look = Object.fromEntries(
    wardrobeFields.map((field) => {
      const options = Object.keys(PAINTED_WARDROBE_FIELDS[field])
      return [field, options[Math.floor(Math.random() * options.length)]!]
    }),
  ) as PaintedWardrobeLook
  return readWardrobeLook(wardrobeRecipe(look))!
}
