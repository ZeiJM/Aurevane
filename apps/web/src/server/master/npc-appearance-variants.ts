import 'server-only'

import { randomInt } from 'node:crypto'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  APPEARANCE_CATALOG,
  compileAppearanceManifest,
  parseAppearanceBlueprint,
  type AppearanceBlueprint,
} from '@/appearance/appearance-manifest'
import {
  NPC_VARIANT_POOL_LIMIT,
  type NpcVariantField,
  type NpcVariantRequest,
} from '@/lib/npc-appearance-variants'
import { findNpcAppearanceConflicts } from './npc-design-store'

const SEARCH_LIMIT = 384
const HIGH_IMPACT_FIELDS = new Set<NpcVariantField>([
  'body',
  'complexion',
  'hair',
  'coat',
  'accessory',
])

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b)
}

function variationPool({ base, vary }: NpcVariantRequest) {
  const seen = new Set([compileAppearanceManifest(base).portraits.neutral])
  const combinations = vary.reduce((size, field) => size * APPEARANCE_CATALOG[field].length, 1)
  const start = randomInt(combinations)
  // Visit unique combinations without walking an arbitrarily large catalog. Small sets are
  // exhausted; a co-prime stride spreads larger samples across the selected features.
  let stride = Math.max(1, Math.floor(combinations / SEARCH_LIMIT))
  while (greatestCommonDivisor(stride, combinations) !== 1) stride++
  const candidates: { blueprint: AppearanceBlueprint; url: string }[] = []
  for (let i = 0; i < Math.min(combinations, SEARCH_LIMIT); i++) {
    let position = (start + i * stride) % combinations
    const draft: Record<string, unknown> = { ...base }
    for (const field of vary) {
      const options = APPEARANCE_CATALOG[field]
      draft[field] = options[position % options.length]
      position = Math.floor(position / options.length)
    }
    const blueprint = parseAppearanceBlueprint(draft)
    if (!blueprint) continue
    const url = compileAppearanceManifest(blueprint).portraits.neutral
    if (seen.has(url)) continue
    seen.add(url)
    candidates.push({ blueprint, url })
    if (candidates.length === NPC_VARIANT_POOL_LIMIT) break
  }
  return candidates
}

export async function previewNpcAppearanceVariants(actorUserId: string, input: NpcVariantRequest) {
  if (input.mode === 'uniform') {
    const url = compileAppearanceManifest(input.base).portraits.neutral
    return Array.from({ length: input.count }, () => url)
  }

  const candidates = variationPool(input)
  const conflicts = new Set(
    candidates.length
      ? await findNpcAppearanceConflicts(
          actorUserId,
          candidates.map(({ url }) => url),
        )
      : [],
  )
  const available = candidates.filter(({ url }) => !conflicts.has(url))
  if (available.length < input.count)
    throw new AurevaneError(
      'INVALID_REQUEST',
      'There are too few unused compatible looks. Let more features vary or request fewer candidates.',
    )

  const selected: string[] = []
  const referenceLooks = [input.base]
  while (selected.length < input.count) {
    // Prefer differences in body, skin, hair, silhouette and accessory over small trim changes.
    let bestIndex = 0
    let bestDistance = -1
    for (const [index, { blueprint }] of available.entries()) {
      const distance = Math.min(
        ...referenceLooks.map((reference) =>
          input.vary.reduce(
            (weight, field) =>
              weight +
              (blueprint[field] === reference[field] ? 0 : HIGH_IMPACT_FIELDS.has(field) ? 3 : 1),
            0,
          ),
        ),
      )
      if (distance > bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    }
    const best = available.splice(bestIndex, 1)[0]!
    selected.push(best.url)
    referenceLooks.push(best.blueprint)
  }
  return selected
}
