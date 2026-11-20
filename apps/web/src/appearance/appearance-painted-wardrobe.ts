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
} satisfies Record<keyof PaintedWardrobeLook, string>

export function wardrobeLook(look: PaintedLook = DEFAULT_PAINTED_LOOK): PaintedWardrobeLook {
  return { bodyFrame: 'natural', skinTone: 'natural', ...look }
}

export function wardrobeRecipe(look: PaintedWardrobeLook) {
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
  ] as const
}

const wardrobeFields = Object.keys(PAINTED_WARDROBE_FIELDS) as (keyof PaintedWardrobeLook)[]

export function readWardrobeLook(values: readonly unknown[]): PaintedWardrobeLook | null {
  if (values.length !== wardrobeFields.length) return null
  for (const [index, field] of wardrobeFields.entries()) {
    const value = values[index]
    if (typeof value !== 'string' || !Object.hasOwn(PAINTED_WARDROBE_FIELDS[field], value))
      return null
  }
  const look = Object.fromEntries(
    wardrobeFields.map((field, index) => [field, values[index]]),
  ) as PaintedWardrobeLook
  return wardrobeRecipe(look).every((value, index) => value === values[index]) ? look : null
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
