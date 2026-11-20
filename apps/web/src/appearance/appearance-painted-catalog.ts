export const PAINTED_IDENTITIES = {
  scout: 'Trail scout',
  ranger: 'Braided ranger',
  guard: 'Highland guard',
  elder: 'Silver wayfarer',
} as const

export const PAINTED_CLOTHING = {
  none: 'Travel clothes',
  compass: 'Compass cape',
  pine: 'Pine mantle',
  hawkmantle: 'Hawk mantle',
  shearling: 'Shearling surcoat',
  scarf: 'Trail scarf',
} as const

export const PAINTED_ACCESSORIES = {
  none: 'None',
  utility: 'Tool belt',
  mapcase: 'Map satchel',
  potions: 'Potion sash',
  bedroll: 'Bedroll',
} as const

export const PAINTED_HEADWEAR = {
  none: 'None',
  arcanist: 'Arcanist hat',
  bandana: 'Trail bandana',
} as const

export const PAINTED_FACEWEAR = {
  none: 'None',
  eyepatch: 'Leather eyepatch',
  goggles: 'Brass goggles',
} as const

export const PAINTED_COLORS = {
  natural: { label: 'Original', rgb: null },
  charcoal: { label: 'Charcoal', rgb: [72, 72, 85] },
  ocean: { label: 'Deep ocean', rgb: [36, 102, 154] },
  teal: { label: 'Verdigris', rgb: [51, 155, 146] },
  ice: { label: 'Frost blue', rgb: [138, 182, 225] },
  cobalt: { label: 'Cobalt', rgb: [54, 75, 192] },
  plum: { label: 'Black plum', rgb: [117, 59, 149] },
  rose: { label: 'Rosewood', rgb: [181, 100, 137] },
  crimson: { label: 'Crimson', rgb: [173, 48, 52] },
  ember: { label: 'Burnished copper', rgb: [211, 111, 48] },
  amber: { label: 'Saffron', rgb: [232, 172, 65] },
  ochre: { label: 'Fallow ochre', rgb: [158, 120, 68] },
  pine: { label: 'Evergreen', rgb: [52, 123, 66] },
  sage: { label: 'Pale sage', rgb: [147, 174, 111] },
  ivory: { label: 'Parchment', rgb: [233, 220, 188] },
} as const

export const PAINTED_FIELDS = {
  identity: PAINTED_IDENTITIES,
  outerwear: PAINTED_CLOTHING,
  clothColor: PAINTED_COLORS,
  gear: PAINTED_ACCESSORIES,
  gearColor: PAINTED_COLORS,
  headwear: PAINTED_HEADWEAR,
  headColor: PAINTED_COLORS,
  facewear: PAINTED_FACEWEAR,
  faceColor: PAINTED_COLORS,
} as const

export type PaintedLook = Readonly<{
  [Field in keyof typeof PAINTED_FIELDS]: keyof (typeof PAINTED_FIELDS)[Field]
}>

export const DEFAULT_PAINTED_LOOK: PaintedLook = {
  identity: 'scout',
  outerwear: 'compass',
  clothColor: 'natural',
  gear: 'none',
  gearColor: 'natural',
  headwear: 'none',
  headColor: 'natural',
  facewear: 'none',
  faceColor: 'natural',
}

export function paintedRecipe(look: PaintedLook) {
  const {
    identity,
    outerwear,
    clothColor,
    gear,
    gearColor,
    headwear,
    headColor,
    facewear,
    faceColor,
  } = look
  return [
    identity,
    outerwear,
    outerwear === 'none' ? 'natural' : clothColor,
    gear,
    gear === 'none' ? 'natural' : gearColor,
    headwear,
    headwear === 'none' ? 'natural' : headColor,
    facewear,
    facewear === 'none' ? 'natural' : faceColor,
  ] as const
}

export function readPaintedLook(values: readonly unknown[]): PaintedLook | null {
  const fields = Object.keys(PAINTED_FIELDS) as (keyof PaintedLook)[]
  if (values.length !== fields.length) return null
  for (const [index, field] of fields.entries()) {
    const value = values[index]
    if (typeof value !== 'string' || !Object.hasOwn(PAINTED_FIELDS[field], value)) return null
  }
  const look = Object.fromEntries(
    fields.map((field, index) => [field, values[index]]),
  ) as PaintedLook
  return paintedRecipe(look).every((value, index) => value === values[index]) ? look : null
}

export function randomPaintedLook(): PaintedLook {
  const random = <Parts extends object>(parts: Parts) => {
    const ids = Object.keys(parts) as (keyof Parts)[]
    return ids[Math.floor(Math.random() * ids.length)]!
  }
  const outerwear = random(PAINTED_CLOTHING)
  const gear = random(PAINTED_ACCESSORIES)
  const headwear = random(PAINTED_HEADWEAR)
  const facewear = random(PAINTED_FACEWEAR)
  return {
    identity: random(PAINTED_IDENTITIES),
    outerwear,
    clothColor: outerwear === 'none' ? 'natural' : random(PAINTED_COLORS),
    gear,
    gearColor: gear === 'none' ? 'natural' : random(PAINTED_COLORS),
    headwear,
    headColor: headwear === 'none' ? 'natural' : random(PAINTED_COLORS),
    facewear,
    faceColor: facewear === 'none' ? 'natural' : random(PAINTED_COLORS),
  }
}
