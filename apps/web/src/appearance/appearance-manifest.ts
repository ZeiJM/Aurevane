import { CUFFS, supportsCuff, type Cuff, type CuffChoice } from './appearance-cuff-catalog'
import {
  LOWER_GARMENTS,
  supportsLowerGarment,
  type LowerGarment,
  type LowerGarmentChoice,
} from './appearance-lower-catalog'
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
type SharedAppearanceParts = {
  readonly [Field in AppearanceField]: Catalog[Field][number]
}

export type AppearanceBlueprint = SharedAppearanceParts &
  (
    | { readonly v: 1 }
    | { readonly v: 2; readonly lower: LowerGarment }
    | { readonly v: 3; readonly lower: LowerGarmentChoice; readonly cuff: Cuff }
  )

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

export const APPEARANCE_ASSET_PREFIX = '/api/media/appearance/'
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
  if (values.v !== 1 && values.v !== 2 && values.v !== 3) return null
  if (Object.keys(values).length !== fields.length + values.v) return null
  if (
    values.v !== 1 &&
    !(values.v === 3 && values.lower === 'original') &&
    !(LOWER_GARMENTS as readonly unknown[]).includes(values.lower)
  )
    return null
  if (values.v === 3 && !(CUFFS as readonly unknown[]).includes(values.cuff)) return null
  for (const field of fields) {
    const choices: readonly unknown[] = APPEARANCE_CATALOG[field]
    if (!choices.includes(values[field])) return null
  }
  const blueprint = values as AppearanceBlueprint
  if (
    appearanceClothingConflict(blueprint) ||
    (blueprint.v !== 1 &&
      blueprint.lower !== 'original' &&
      !supportsLowerGarment(blueprint.coat)) ||
    (blueprint.v === 3 && !supportsCuff(blueprint.coat))
  )
    return null
  return Object.freeze({ ...blueprint })
}

export function withLowerGarment(
  blueprint: AppearanceBlueprint,
  choice: LowerGarmentChoice,
): AppearanceBlueprint | null {
  if (blueprint.v === 3) return parseAppearanceBlueprint({ ...blueprint, lower: choice })
  if (choice !== 'original') return parseAppearanceBlueprint({ ...blueprint, v: 2, lower: choice })
  if (blueprint.v === 1) return blueprint
  const { lower: _lower, ...parts } = blueprint
  return parseAppearanceBlueprint({ ...parts, v: 1 })
}

export function withCuff(
  blueprint: AppearanceBlueprint,
  choice: CuffChoice,
): AppearanceBlueprint | null {
  if (choice !== 'original') {
    return parseAppearanceBlueprint({
      ...blueprint,
      v: 3,
      lower: blueprint.v === 1 ? 'original' : blueprint.lower,
      cuff: choice,
    })
  }
  if (blueprint.v !== 3) return blueprint
  const { cuff: _cuff, lower, ...parts } = blueprint
  return parseAppearanceBlueprint(
    lower === 'original' ? { ...parts, v: 1 } : { ...parts, v: 2, lower },
  )
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
  const parts: string[] = fields.map((field) => blueprint[field])
  if (blueprint.v !== 1) parts.push(blueprint.lower)
  if (blueprint.v === 3) parts.push(blueprint.cuff)
  const id = `${blueprint.v}/${parts.join('.')}`
  const base = `${APPEARANCE_ASSET_PREFIX}${id}`
  const portraits = Object.freeze(
    Object.fromEntries(
      APPEARANCE_EXPRESSIONS.map((mood) => [mood, `${base}/${mood}.svg`]),
    ) as Record<AppearanceExpression, string>,
  )
  return Object.freeze({
    id,
    blueprint,
    portraits,
    icon: `${base}/icon.svg`,
    atlas: `${base}/atlas.svg`,
    frame: APPEARANCE_FRAME,
  })
}

export type AppearanceManifest = ReturnType<typeof compileAppearanceManifest>

export function appearanceBlueprintFromId(
  id: string,
  assetVersion: AppearanceBlueprint['v'] | string = 1,
): AppearanceBlueprint | null {
  const version =
    assetVersion === 1 || assetVersion === '1'
      ? 1
      : assetVersion === 2 || assetVersion === '2'
        ? 2
        : assetVersion === 3 || assetVersion === '3'
          ? 3
          : null
  if (version === null || id.length > 140) return null
  const parts = id.split('.')
  if (parts.length !== fields.length + version - 1) return null
  return parseAppearanceBlueprint({
    v: version,
    ...Object.fromEntries(fields.map((field, index) => [field, parts[index]])),
    ...(version !== 1 ? { lower: parts[fields.length] } : {}),
    ...(version === 3 ? { cuff: parts[fields.length + 1] } : {}),
  })
}

export function appearanceManifestFromImageUrl(url: string | null | undefined) {
  if (!url?.startsWith(APPEARANCE_ASSET_PREFIX) || !url.endsWith('/neutral.svg')) return null
  const [version, id, extra] = url
    .slice(APPEARANCE_ASSET_PREFIX.length, -'/neutral.svg'.length)
    .split('/')
  if (!version || !id || extra !== undefined) return null
  const blueprint = appearanceBlueprintFromId(id, version)
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
