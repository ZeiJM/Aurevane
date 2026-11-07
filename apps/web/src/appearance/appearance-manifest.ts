import { WARDROBE_CUTS, appearanceClothingConflict } from './appearance-wardrobe-catalog'

export const APPEARANCE_EXPRESSIONS = ['neutral', 'happy', 'angry', 'sad', 'surprised'] as const
export const APPEARANCE_FACINGS = ['south', 'east', 'north', 'west'] as const
export const APPEARANCE_POSES = ['idle', 'walk', 'attack', 'cast', 'hit', 'down'] as const

export const APPEARANCE_CATALOG = {
  body: ['slight', 'average', 'broad'],
  complexion: ['light', 'tan', 'brown', 'deep'],
  hair: ['crop', 'swept', 'braid', 'curls'],
  hairColor: ['onyx', 'oak', 'copper', 'silver'],
  coat: ['tunic', 'longcoat', 'mantle', 'plate', ...WARDROBE_CUTS],
  collar: ['open', 'standing', 'fur'],
  sleeves: ['close', 'puffed', 'split'],
  closure: ['buttons', 'lacing', 'clasps'],
  hem: ['plain', 'split', 'pointed'],
  textile: ['linen', 'brocade', 'quilt'],
  accessory: ['none', 'satchel', 'scarf', 'brooch'],
  palette: ['pine', 'garnet', 'indigo', 'saffron', 'slate', 'ivory'],
} as const

type Catalog = typeof APPEARANCE_CATALOG
type AppearanceField = keyof Catalog
export type AppearanceBlueprint = { readonly v: 1 } & {
  readonly [Field in AppearanceField]: Catalog[Field][number]
}

export type AppearanceExpression = (typeof APPEARANCE_EXPRESSIONS)[number]
export type AppearanceFacing = (typeof APPEARANCE_FACINGS)[number]
export type AppearancePose = (typeof APPEARANCE_POSES)[number]
export type AppearanceAsset = AppearanceExpression | 'icon' | 'atlas'

export const APPEARANCE_FRAME = {
  width: 48,
  height: 64,
  anchorX: 24,
  anchorY: 58,
  frames: 3,
  columns: APPEARANCE_FACINGS.length * 3,
  rows: APPEARANCE_POSES.length,
} as const

const ASSET_ROOT = '/api/media/appearance/1'
const fields = Object.keys(APPEARANCE_CATALOG) as AppearanceField[]

export const APPEARANCE_PRESETS = [
  {
    name: 'Pine Scout',
    blueprint: {
      v: 1,
      body: 'slight',
      complexion: 'tan',
      hair: 'braid',
      hairColor: 'copper',
      coat: 'tunic',
      collar: 'open',
      sleeves: 'split',
      closure: 'lacing',
      hem: 'pointed',
      textile: 'linen',
      accessory: 'satchel',
      palette: 'pine',
    },
  },
  {
    name: 'Winter Guard',
    blueprint: {
      v: 1,
      body: 'broad',
      complexion: 'deep',
      hair: 'crop',
      hairColor: 'onyx',
      coat: 'plate',
      collar: 'fur',
      sleeves: 'close',
      closure: 'clasps',
      hem: 'split',
      textile: 'quilt',
      accessory: 'brooch',
      palette: 'indigo',
    },
  },
  {
    name: 'Ember Envoy',
    blueprint: {
      v: 1,
      body: 'average',
      complexion: 'light',
      hair: 'curls',
      hairColor: 'silver',
      coat: 'mantle',
      collar: 'standing',
      sleeves: 'puffed',
      closure: 'buttons',
      hem: 'plain',
      textile: 'brocade',
      accessory: 'scarf',
      palette: 'garnet',
    },
  },
] as const satisfies readonly { name: string; blueprint: AppearanceBlueprint }[]

export function parseAppearanceBlueprint(input: unknown): AppearanceBlueprint | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null
  const values = input as Record<string, unknown>
  if (values.v !== 1 || Object.keys(values).length !== fields.length + 1) return null
  for (const field of fields) {
    const choices: readonly unknown[] = APPEARANCE_CATALOG[field]
    if (!choices.includes(values[field])) return null
  }
  const blueprint = values as AppearanceBlueprint
  if (appearanceClothingConflict(blueprint)) return null
  return Object.freeze({ ...blueprint })
}

export function varyAppearanceOutfit(blueprint: AppearanceBlueprint): AppearanceBlueprint {
  const cuts = APPEARANCE_CATALOG.coat
  const index = cuts.indexOf(blueprint.coat)
  for (let offset = 1; offset < cuts.length; offset++) {
    const coat = cuts[(index + offset) % cuts.length]
    const candidate = parseAppearanceBlueprint({ ...blueprint, coat })
    if (candidate) return candidate
  }
  return blueprint
}

export function compileAppearanceManifest(input: AppearanceBlueprint) {
  const blueprint = parseAppearanceBlueprint(input)
  if (!blueprint) throw new TypeError('Incompatible appearance')
  const id = fields.map((field) => blueprint[field]).join('.')
  const base = `${ASSET_ROOT}/${id}`
  const portraits = Object.freeze(
    Object.fromEntries(
      APPEARANCE_EXPRESSIONS.map((mood) => [mood, `${base}/${mood}.svg`]),
    ) as Record<AppearanceExpression, string>,
  )
  return Object.freeze({
    id: `1/${id}`,
    blueprint,
    portraits,
    icon: `${base}/icon.svg`,
    atlas: `${base}/atlas.svg`,
    frame: APPEARANCE_FRAME,
  })
}

export type AppearanceManifest = ReturnType<typeof compileAppearanceManifest>

export function appearanceBlueprintFromId(id: string): AppearanceBlueprint | null {
  if (id.length > 140) return null
  const parts = id.split('.')
  if (parts.length !== fields.length) return null
  return parseAppearanceBlueprint({
    v: 1,
    ...Object.fromEntries(fields.map((field, index) => [field, parts[index]])),
  })
}

export function appearanceManifestFromImageUrl(url: string | null | undefined) {
  if (!url?.startsWith(`${ASSET_ROOT}/`) || !url.endsWith('/neutral.svg')) return null
  const id = url.slice(ASSET_ROOT.length + 1, -'/neutral.svg'.length)
  const blueprint = appearanceBlueprintFromId(id)
  return blueprint ? compileAppearanceManifest(blueprint) : null
}

export function isAppearanceAsset(value: string): value is AppearanceAsset {
  return (
    value === 'atlas' || value === 'icon' || APPEARANCE_EXPRESSIONS.some((mood) => mood === value)
  )
}

export function appearanceFrameIndex(
  facing: AppearanceFacing,
  pose: AppearancePose,
  frame: number,
) {
  return {
    column: APPEARANCE_FACINGS.indexOf(facing) * APPEARANCE_FRAME.frames + frame,
    row: APPEARANCE_POSES.indexOf(pose),
  }
}
