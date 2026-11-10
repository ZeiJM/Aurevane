import {
  APPEARANCE_CATALOG,
  parseAppearanceBlueprint,
  type AppearanceBlueprint,
} from '@/appearance/appearance-manifest'

export const NPC_VARIANT_BATCH_MIN = 2
export const NPC_VARIANT_BATCH_MAX = 8
export const NPC_VARIANT_POOL_LIMIT = 64
export type NpcVariantField = keyof typeof APPEARANCE_CATALOG
export const NPC_VARIANT_FIELDS = Object.keys(APPEARANCE_CATALOG) as NpcVariantField[]

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
    vary.length > NPC_VARIANT_FIELDS.length ||
    !vary.every((field): field is NpcVariantField => NPC_VARIANT_FIELDS.includes(field)) ||
    new Set(vary).size !== vary.length ||
    (mode !== 'distinct' && mode !== 'uniform') ||
    (mode === 'distinct' ? vary.length === 0 : vary.length !== 0)
  )
    return null
  return { base: blueprint, count, vary, mode }
}
