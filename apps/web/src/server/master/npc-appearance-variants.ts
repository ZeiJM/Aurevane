import { PORTRAIT_FACES, portraitFace } from '@/appearance/appearance-face-catalog'
import 'server-only'

import { randomInt } from 'node:crypto'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  APPEARANCE_CATALOG,
  paintedAppearanceBlueprint,
  paintedPlayerAppearanceBlueprint,
  compileAppearanceManifest,
  parseAppearanceBlueprint,
  wardrobeAppearanceBlueprint,
  type AppearanceBlueprint,
} from '@/appearance/appearance-manifest'
import { PAINTED_FIELDS, type PaintedLook } from '@/appearance/appearance-painted-catalog'
import {
  PAINTED_PLAYER_FIELDS,
  PAINTED_WARDROBE_FIELDS,
  type PaintedPlayerLook,
  type PaintedWardrobeLook,
} from '@/appearance/appearance-painted-wardrobe'
import {
  NPC_VARIANT_POOL_LIMIT,
  type LegacyNpcVariantField,
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
  'identity',
  'hairstyle',
  'bodyFrame',
  'skinTone',
  'outerwear',
  'gear',
  'headwear',
  'facewear',
])

function greatestCommonDivisor(a: bigint, b: bigint): bigint {
  return b === 0n ? a : greatestCommonDivisor(b, a % b)
}

const paintedVariationFields: Partial<Record<NpcVariantField, keyof PaintedLook>> = {
  body: 'identity',
  coat: 'outerwear',
  palette: 'clothColor',
  accessory: 'gear',
  hairColor: 'gearColor',
}

function variationValue(blueprint: AppearanceBlueprint, field: NpcVariantField) {
  if (blueprint.v === 6)
    return field === 'identity'
      ? (blueprint.faceId ?? blueprint.identity)
      : blueprint[field as keyof PaintedPlayerLook]
  if (blueprint.v === 5) return blueprint[field as keyof PaintedWardrobeLook]
  const paintedField = paintedVariationFields[field]
  return blueprint.v === 4 && paintedField
    ? blueprint[paintedField]
    : blueprint[field as LegacyNpcVariantField]
}

function variationPool({ base, vary }: NpcVariantRequest) {
  const seen = new Set([compileAppearanceManifest(base).neutralUrl])
  const parts = vary.map((field) => {
    if (base.v === 6)
      return {
        field,
        options:
          field === 'identity'
            ? PORTRAIT_FACES.map(({ id }) => id)
            : Object.keys(PAINTED_PLAYER_FIELDS[field as keyof typeof PAINTED_PLAYER_FIELDS]),
      }
    if (base.v === 5)
      return {
        field,
        options: Object.keys(PAINTED_WARDROBE_FIELDS[field as keyof PaintedWardrobeLook]),
      }
    const paintedField = paintedVariationFields[field]
    return base.v === 4 && paintedField
      ? { field: paintedField, options: Object.keys(PAINTED_FIELDS[paintedField]) }
      : { field, options: APPEARANCE_CATALOG[field as LegacyNpcVariantField] }
  })
  const combinations = parts.reduce((size, { options }) => size * BigInt(options.length), 1n)
  const start = parts.reduce(
    (position, { options }) =>
      position * BigInt(options.length) + BigInt(randomInt(options.length)),
    0n,
  )
  // Visit unique combinations without walking an arbitrarily large catalog. Small sets are
  // exhausted; a co-prime stride spreads larger samples across the selected features.
  const limit = BigInt(SEARCH_LIMIT)
  let stride = combinations >= limit ? combinations / limit : 1n
  while (greatestCommonDivisor(stride, combinations) !== 1n) stride++
  const candidates: { blueprint: AppearanceBlueprint; url: string }[] = []
  for (let i = 0n; i < combinations && i < limit; i++) {
    let position = (start + i * stride) % combinations
    const draft: Record<string, unknown> = { ...base }
    for (const { field, options } of parts) {
      const radix = BigInt(options.length)
      draft[field] = options[Number(position % radix)]
      if (base.v === 6 && field === 'identity') {
        const face = portraitFace(draft[field])!
        draft.faceId = face.id
        draft.identity = face.rig
      }
      position /= radix
    }
    const blueprint =
      base.v === 6
        ? paintedPlayerAppearanceBlueprint(draft as PaintedPlayerLook)
        : base.v === 5
          ? wardrobeAppearanceBlueprint(draft as PaintedWardrobeLook)
          : base.v === 4
            ? paintedAppearanceBlueprint(draft as PaintedLook)
            : parseAppearanceBlueprint(draft)
    if (!blueprint) continue
    const url = compileAppearanceManifest(blueprint).neutralUrl
    if (seen.has(url)) continue
    seen.add(url)
    candidates.push({ blueprint, url })
    if (candidates.length === NPC_VARIANT_POOL_LIMIT) break
  }
  return candidates
}

export async function previewNpcAppearanceVariants(actorUserId: string, input: NpcVariantRequest) {
  if (input.mode === 'uniform') {
    const url = compileAppearanceManifest(input.base).neutralUrl
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
              (variationValue(blueprint, field) === variationValue(reference, field)
                ? 0
                : HIGH_IMPACT_FIELDS.has(field)
                  ? 3
                  : 1),
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
