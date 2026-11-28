import type { AuthoredAppearanceBlueprint } from '@/appearance/appearance-authored-catalog'
import { parseAppearanceBlueprint } from '@/appearance/appearance-manifest'

export const NPC_VARIANT_BATCH_MIN = 2
export const NPC_VARIANT_BATCH_MAX = 8
export const NPC_VARIANT_POOL_LIMIT = 64
export const NPC_VARIANT_FIELDS = ['character', 'variant'] as const
export type NpcVariantField = (typeof NPC_VARIANT_FIELDS)[number]

export type NpcVariantRequest = {
  base: AuthoredAppearanceBlueprint
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
    blueprint?.v !== 7 ||
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < NPC_VARIANT_BATCH_MIN ||
    count > NPC_VARIANT_BATCH_MAX ||
    !Array.isArray(vary) ||
    !vary.every(
      (field): field is NpcVariantField => field === 'character' || field === 'variant',
    ) ||
    new Set(vary).size !== vary.length ||
    (mode !== 'distinct' && mode !== 'uniform') ||
    (mode === 'distinct' ? vary.length === 0 : vary.length !== 0)
  )
    return null

  return { base: blueprint, count, vary, mode }
}
