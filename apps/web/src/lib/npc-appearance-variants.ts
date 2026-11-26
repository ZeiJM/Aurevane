import {
  APPEARANCE_CATALOG,
  parseAppearanceBlueprint,
  type AppearanceBlueprint,
} from '@/appearance/appearance-manifest'
import {
  isActivePaintedAppearance,
  activePaintedLookKey,
} from '@/appearance/appearance-active-catalog'
import type { PaintedPlayerLook } from '@/appearance/appearance-painted-wardrobe'

export const NPC_VARIANT_BATCH_MIN = 2
export const NPC_VARIANT_BATCH_MAX = 8
export const NPC_VARIANT_POOL_LIMIT = 64
export type LegacyNpcVariantField = keyof typeof APPEARANCE_CATALOG
export type NpcVariantField = LegacyNpcVariantField | keyof PaintedPlayerLook
export const NPC_VARIANT_FIELDS = Object.keys(APPEARANCE_CATALOG) as LegacyNpcVariantField[]
export const NPC_PAINTED_VARIANT_FIELDS: LegacyNpcVariantField[] = [
  'body',
  'coat',
  'palette',
  'accessory',
  'hairColor',
]

export function npcVariantFields(blueprint: AppearanceBlueprint): readonly NpcVariantField[] {
  if (!isActivePaintedAppearance(blueprint)) return []
  return activePaintedLookKey(blueprint) === 'asta' ? ['backdrop', 'clothColor'] : ['backdrop']
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
    !isActivePaintedAppearance(blueprint) ||
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
