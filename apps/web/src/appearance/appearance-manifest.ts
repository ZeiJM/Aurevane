import { portraitFace } from './appearance-face-catalog'
import {
  PAINTED_CLOTHING,
  PAINTED_FIELDS,
  paintedRecipe,
  readPaintedLook,
  type PaintedLook,
} from './appearance-painted-catalog'
import {
  PAINTED_PLAYER_FIELDS,
  PAINTED_WARDROBE_FIELDS,
  originalWardrobeFeatures,
  paintedPlayerRecipe,
  WARDROBE_OUTERWEAR,
  readPaintedPlayerLook,
  paintedDetailRecipe,
  PLAYER_APPEARANCE_DETAILS,
  readWardrobeLook,
  wardrobeRecipe,
  type PaintedPlayerLook,
  type PaintedWardrobeLook,
} from './appearance-painted-wardrobe'
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

const scoutBase = {
  body: 'average',
  complexion: 'tan',
  hair: 'swept',
  hairColor: 'onyx',
  coat: 'tunic',
  collar: 'standing',
  sleeves: 'close',
  closure: 'clasps',
  hem: 'plain',
  textile: 'quilt',
  accessory: 'satchel',
  palette: 'slate',
} as const satisfies SharedAppearanceParts

const paintedIdentityParts = {
  scout: {},
  ranger: { body: 'slight', complexion: 'brown', hair: 'braid' },
  guard: { body: 'broad', complexion: 'deep', hair: 'crop' },
  elder: { complexion: 'light', hair: 'swept', hairColor: 'silver' },
  pinescout: { body: 'slight', hair: 'braid', hairColor: 'copper', palette: 'pine' },
} as const satisfies Record<PaintedPlayerLook['identity'], Partial<SharedAppearanceParts>>

export type PaintedAppearanceBlueprint = SharedAppearanceParts & PaintedLook & { readonly v: 4 }
export type WardrobeAppearanceBlueprint = SharedAppearanceParts &
  PaintedWardrobeLook & { readonly v: 5 }
export type PaintedPlayerAppearanceBlueprint = SharedAppearanceParts &
  PaintedPlayerLook & { readonly v: 6 }
export type AnyPaintedAppearanceBlueprint =
  PaintedAppearanceBlueprint | WardrobeAppearanceBlueprint | PaintedPlayerAppearanceBlueprint

export function paintedAppearanceBlueprint(look: PaintedLook): PaintedAppearanceBlueprint {
  const [
    identity,
    outerwear,
    clothColor,
    gear,
    gearColor,
    headwear,
    headColor,
    facewear,
    faceColor,
  ] = paintedRecipe(look)
  return Object.freeze({
    ...scoutBase,
    ...paintedIdentityParts[identity],
    identity,
    outerwear,
    clothColor,
    gear,
    gearColor,
    headwear,
    headColor,
    facewear,
    faceColor,
    v: 4,
  })
}

export function wardrobeAppearanceBlueprint(
  look: PaintedWardrobeLook,
): WardrobeAppearanceBlueprint {
  const normalized = readWardrobeLook(wardrobeRecipe(look))
  if (!normalized) throw new TypeError('Incompatible painted wardrobe')
  return Object.freeze({
    ...scoutBase,
    ...paintedIdentityParts[look.identity],
    ...normalized,
    v: 5,
  })
}

export function paintedPlayerAppearanceBlueprint(
  look: PaintedPlayerLook,
): PaintedPlayerAppearanceBlueprint {
  const normalized = readPaintedPlayerLook(paintedPlayerRecipe(look))
  if (!normalized || normalized.identity !== look.identity || normalized.faceId !== look.faceId)
    throw new TypeError('Incompatible painted appearance')
  return Object.freeze({
    ...scoutBase,
    ...paintedIdentityParts[look.identity],
    ...normalized,
    v: 6,
  })
}

export type AppearanceBlueprint = SharedAppearanceParts &
  (
    | { readonly v: 1 }
    | { readonly v: 2; readonly lower: LowerGarment }
    | { readonly v: 3; readonly lower: LowerGarmentChoice; readonly cuff: Cuff }
    | AnyPaintedAppearanceBlueprint
  )

export type AppearanceExpression = (typeof APPEARANCE_EXPRESSIONS)[number]
export type AppearanceFacing = (typeof APPEARANCE_FACINGS)[number]
export type AppearancePose = (typeof APPEARANCE_POSES)[number]
export type AppearanceAsset = AppearanceExpression | 'icon' | 'atlas' | 'motion' | 'motion-v2'

export const APPEARANCE_FRAME = {
  width: 48,
  height: 64,
  anchorX: 24,
  anchorY: 58,
  frames: 3,
  columns: APPEARANCE_FACINGS.length * 3,
  rows: APPEARANCE_POSES.length,
} as const

const motionFrames = 8

export const APPEARANCE_MOTION_FRAME = {
  ...APPEARANCE_FRAME,
  frames: motionFrames,
  columns: APPEARANCE_FACINGS.length * motionFrames,
} as const

export const APPEARANCE_WALK_CYCLE_MS = 640
export const APPEARANCE_READY_CYCLE_MS = 2400

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
  if (values.v === 5 || values.v === 6) {
    const featureFields = Object.keys(originalWardrobeFeatures)
    const hasFeatures = featureFields.some((field) => Object.hasOwn(values, field))
    const catalog = values.v === 6 ? PAINTED_PLAYER_FIELDS : PAINTED_WARDROBE_FIELDS
    const detailFields =
      values.v === 6
        ? PLAYER_APPEARANCE_DETAILS.filter((field) => Object.hasOwn(values, field))
        : []
    if (detailFields.some((field) => typeof values[field] !== 'string')) return null
    const details = paintedDetailRecipe(values)
    if (detailFields.length !== details.length) return null
    const wardrobeFields = Object.keys(catalog).filter(
      (field) =>
        !PLAYER_APPEARANCE_DETAILS.some((detail) => detail === field) &&
        (hasFeatures || !featureFields.includes(field)),
    )
    const hasFace = values.v === 6 && Object.hasOwn(values, 'faceId')
    if (hasFace && portraitFace(values.faceId)?.rig !== values.identity) return null
    const part = (field: string) =>
      field === 'identity' && hasFace ? values.faceId : values[field]
    if (
      Object.keys(values).length !==
      fields.length + wardrobeFields.length + 1 + Number(hasFace) + detailFields.length
    )
      return null
    const originalFeatures = featureFields.every((field) => values[field] === 'natural')
    const parts = wardrobeFields
      .filter((field) => !originalFeatures || !featureFields.includes(field))
      .flatMap((field) => (field === 'backdrop' ? [...details, part(field)] : [part(field)]))
    const blueprint =
      values.v === 6 ? playerBlueprintFromParts(parts) : wardrobeBlueprintFromParts(parts)
    return blueprint &&
      fields.every((field) => values[field] === blueprint[field]) &&
      (blueprint.v !== 6 || detailFields.every((field) => values[field] === blueprint[field]))
      ? blueprint
      : null
  }
  if (values.v === 4) {
    const paintedFields = Object.keys(PAINTED_FIELDS)
    const look = readPaintedLook(paintedFields.map((field) => values[field]))
    if (!look || Object.keys(values).length !== fields.length + paintedFields.length + 1)
      return null
    const blueprint = paintedAppearanceBlueprint(look)
    return fields.every((field) => values[field] === blueprint[field]) ? blueprint : null
  }
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
  const blueprint = values as Exclude<AppearanceBlueprint, AnyPaintedAppearanceBlueprint>
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
  if (blueprint.v === 4 || blueprint.v === 5 || blueprint.v === 6)
    return choice === 'original' ? blueprint : null
  if (blueprint.v === 3) return parseAppearanceBlueprint({ ...blueprint, lower: choice })
  if (choice !== 'original') return parseAppearanceBlueprint({ ...blueprint, v: 2, lower: choice })
  if (blueprint.v === 1) return blueprint
  return parseAppearanceBlueprint({
    v: 1,
    ...Object.fromEntries(fields.map((field) => [field, blueprint[field]])),
  })
}

export function withCuff(
  blueprint: AppearanceBlueprint,
  choice: CuffChoice,
): AppearanceBlueprint | null {
  if (blueprint.v === 4 || blueprint.v === 5 || blueprint.v === 6)
    return choice === 'original' ? blueprint : null
  if (choice !== 'original') {
    return parseAppearanceBlueprint({
      ...blueprint,
      v: 3,
      lower: blueprint.v === 1 ? 'original' : blueprint.lower,
      cuff: choice,
    })
  }
  if (blueprint.v !== 3) return blueprint
  const { lower } = blueprint
  const parts = Object.fromEntries(fields.map((field) => [field, blueprint[field]]))
  return parseAppearanceBlueprint(
    lower === 'original' ? { ...parts, v: 1 } : { ...parts, v: 2, lower },
  )
}

export function varyAppearanceOutfit(blueprint: AppearanceBlueprint): AppearanceBlueprint {
  if (blueprint.v === 5 || blueprint.v === 6) {
    const outerwear = Object.keys(WARDROBE_OUTERWEAR) as PaintedWardrobeLook['outerwear'][]
    const index = outerwear.indexOf(blueprint.outerwear)
    const next = outerwear[(index + 1) % outerwear.length]!
    return blueprint.v === 6
      ? paintedPlayerAppearanceBlueprint({ ...blueprint, outerwear: next })
      : wardrobeAppearanceBlueprint({ ...blueprint, outerwear: next })
  }
  if (blueprint.v === 4) {
    const outerwear = Object.keys(PAINTED_CLOTHING) as PaintedLook['outerwear'][]
    const index = outerwear.indexOf(blueprint.outerwear)
    return paintedAppearanceBlueprint({
      ...blueprint,
      outerwear: outerwear[(index + 1) % outerwear.length]!,
    })
  }
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
  const parts: string[] =
    blueprint.v === 6
      ? [...paintedPlayerRecipe(blueprint)]
      : blueprint.v === 5
        ? [...wardrobeRecipe(blueprint)]
        : blueprint.v === 4
          ? [...paintedRecipe(blueprint)]
          : fields.map((field) => blueprint[field])
  if (blueprint.v === 2 || blueprint.v === 3) parts.push(blueprint.lower)
  if (blueprint.v === 3) parts.push(blueprint.cuff)
  const id = `${blueprint.v}/${parts.join('.')}`
  const base = `${APPEARANCE_ASSET_PREFIX}${id}`
  const neutralUrl = `${base}/neutral.svg`
  const assetPrefix = blueprint.v === 6 ? 'illustrated-' : ''
  const portraits = Object.freeze(
    Object.fromEntries(
      APPEARANCE_EXPRESSIONS.map((mood) => [mood, `${base}/${assetPrefix}${mood}.svg`]),
    ) as Record<AppearanceExpression, string>,
  )
  return Object.freeze({
    id,
    blueprint,
    neutralUrl,
    portraits,
    icon: `${base}/${assetPrefix}icon.svg`,
    atlas: `${base}/${assetPrefix}atlas.svg`,
    motionAtlas: `${base}/${assetPrefix}motion-v2.svg`,
    frame: APPEARANCE_FRAME,
  })
}

export type AppearanceManifest = ReturnType<typeof compileAppearanceManifest>

function wardrobeBlueprintFromParts(parts: readonly unknown[]) {
  const look = readWardrobeLook(parts)
  return look ? wardrobeAppearanceBlueprint(look) : null
}

function playerBlueprintFromParts(parts: readonly unknown[]) {
  const look = readPaintedPlayerLook(parts)
  return look ? paintedPlayerAppearanceBlueprint(look) : null
}

export function appearanceBlueprintFromId(
  id: string,
  assetVersion: AppearanceBlueprint['v'] | string = 1,
): AppearanceBlueprint | null {
  if (assetVersion === 6 || assetVersion === '6') {
    return id.length <= 225 ? playerBlueprintFromParts(id.split('.')) : null
  }
  if (assetVersion === 5 || assetVersion === '5') {
    if (id.length > 140) return null
    return wardrobeBlueprintFromParts(id.split('.'))
  }
  if (assetVersion === 4 || assetVersion === '4') {
    const look = readPaintedLook(id.split('.'))
    return look ? paintedAppearanceBlueprint(look) : null
  }
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
  if (!url?.startsWith(APPEARANCE_ASSET_PREFIX)) return null
  const [version, id, asset, extra] = url.slice(APPEARANCE_ASSET_PREFIX.length).split('/')
  if (asset !== 'neutral.svg' && !(version === '6' && asset === 'illustrated-neutral.svg'))
    return null
  if (!version || !id || extra !== undefined) return null
  const blueprint = appearanceBlueprintFromId(id, version)
  return blueprint ? compileAppearanceManifest(blueprint) : null
}

export function isAppearanceAsset(value: string): value is AppearanceAsset {
  return (
    value === 'atlas' ||
    value === 'motion' ||
    value === 'motion-v2' ||
    value === 'icon' ||
    APPEARANCE_EXPRESSIONS.some((mood) => mood === value)
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

export function appearanceMotionFrameIndex(
  facing: AppearanceFacing,
  pose: AppearancePose,
  frame: number,
) {
  return {
    column: APPEARANCE_FACINGS.indexOf(facing) * APPEARANCE_MOTION_FRAME.frames + frame,
    row: APPEARANCE_POSES.indexOf(pose),
  }
}

export function appearanceWalkFrame(elapsedMs: number) {
  return (
    Math.floor((elapsedMs * APPEARANCE_MOTION_FRAME.frames) / APPEARANCE_WALK_CYCLE_MS) %
    APPEARANCE_MOTION_FRAME.frames
  )
}
