import {
  APPEARANCE_CATALOG,
  parseAppearanceBlueprint,
  type AppearanceBlueprint,
} from '@/appearance/appearance-manifest'
import {
  PAINTED_WARDROBE_FIELDS,
  type PaintedWardrobeLook,
} from '@/appearance/appearance-painted-wardrobe'

export const NPC_VARIANT_BATCH_MIN = 2
export const NPC_VARIANT_BATCH_MAX = 8
export const NPC_VARIANT_POOL_LIMIT = 64
export type LegacyNpcVariantField = keyof typeof APPEARANCE_CATALOG
export type NpcVariantField = LegacyNpcVariantField | keyof PaintedWardrobeLook
export const NPC_VARIANT_FIELDS = Object.keys(APPEARANCE_CATALOG) as LegacyNpcVariantField[]
export const NPC_PAINTED_VARIANT_FIELDS: LegacyNpcVariantField[] = [
  'body',
  'coat',
  'palette',
  'accessory',
  'hairColor',
]

export function npcVariantFields(blueprint: AppearanceBlueprint): readonly NpcVariantField[] {
  if (blueprint.v === 5)
    return Object.keys(PAINTED_WARDROBE_FIELDS) as (keyof PaintedWardrobeLook)[]
  return blueprint.v === 4 ? NPC_PAINTED_VARIANT_FIELDS : NPC_VARIANT_FIELDS
}

export type NpcVariantRequest = {
  base: AppearanceBlueprint
  count: number
  vary: NpcVariantField[]
  mode: 'distinct' | 'uniform'
}

export function parseNpcVariantRequest(input: unknown): NpcVariantRequest | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const { base, count, vary, mode, ...extra } = input as Record<string, unknown>
  const blueprint = parseAppearanceBlueprint(base)
  if (
    Object.keys(extra).length ||
    !blueprint ||
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < NPC_VARIANT_BATCH_MIN ||
    count > NPC_VARIANT_BATCH_MAX ||
    !Array.isArray(vary) ||
    !vary.every((field): field is NpcVariantField => npcVariantFields(blueprint).includes(field)) ||
    new Set(vary).size !== vary.length ||
    (mode !== 'distinct' && mode !== 'uniform') ||
    (mode === 'distinct' ? vary.length === 0 : vary.length !== 0)
  )
    return null
  return { base: blueprint, count, vary, mode }
}
