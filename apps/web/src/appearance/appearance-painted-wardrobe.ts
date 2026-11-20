import {
  DEFAULT_PAINTED_LOOK,
  PAINTED_ACCESSORIES,
  PAINTED_CLOTHING,
  PAINTED_COLORS,
  PAINTED_FIELDS,
  type PaintedLook,
} from './appearance-painted-catalog'

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
  eyeColor: 'Eye color',
} satisfies Record<keyof PaintedWardrobeLook, string>

export const originalWardrobeFeatures = {
  hairstyle: 'natural',
  hairDye: 'natural',
  eyeColor: 'natural',
} as const

export function wardrobeLook(look: PaintedLook = DEFAULT_PAINTED_LOOK): PaintedWardrobeLook {
  return { bodyFrame: 'natural', skinTone: 'natural', ...originalWardrobeFeatures, ...look }
}

export function wardrobeRecipe(look: PaintedWardrobeLook) {
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

const wardrobeFields = Object.keys(PAINTED_WARDROBE_FIELDS) as (keyof PaintedWardrobeLook)[]
const originalFieldCount = wardrobeFields.length - Object.keys(originalWardrobeFeatures).length

export function readWardrobeLook(values: readonly unknown[]): PaintedWardrobeLook | null {
  if (values.length !== originalFieldCount && values.length !== wardrobeFields.length) return null
  const fields = wardrobeFields.slice(0, values.length)
  for (const [index, field] of fields.entries()) {
    const value = values[index]
    if (typeof value !== 'string' || !Object.hasOwn(PAINTED_WARDROBE_FIELDS[field], value))
      return null
  }
  const look = {
    ...originalWardrobeFeatures,
    ...Object.fromEntries(fields.map((field, index) => [field, values[index]])),
  } as PaintedWardrobeLook
  const recipe = wardrobeRecipe(look)
  return recipe.length === values.length && recipe.every((value, index) => value === values[index])
    ? look
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
