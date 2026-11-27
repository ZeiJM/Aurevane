import 'server-only'

import { randomInt } from 'node:crypto'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  AUTHORED_CHARACTERS,
  authoredAppearance,
  authoredCharacter,
  type AuthoredAppearanceVariant,
} from '@/appearance/appearance-authored-catalog'
import { compileAppearanceManifest } from '@/appearance/appearance-manifest'
import { NPC_VARIANT_POOL_LIMIT, type NpcVariantRequest } from '@/lib/npc-appearance-variants'
import { findNpcAppearanceConflicts } from './npc-design-store'

export async function previewNpcAppearanceVariants(actorUserId: string, input: NpcVariantRequest) {
  const baseUrl = compileAppearanceManifest(input.base).neutralUrl
  if (input.mode === 'uniform') return Array.from({ length: input.count }, () => baseUrl)

  const base = authoredCharacter(input.base.character)!
  const varyingCharacter = input.vary.includes('character')
  const characters = varyingCharacter
    ? AUTHORED_CHARACTERS.filter(({ race, gender }) => race === base.race && gender === base.gender)
    : [base]
  const variants: readonly AuthoredAppearanceVariant[] = input.vary.includes('variant')
    ? [input.base.variant, input.base.variant === 1 ? 2 : 1]
    : [input.base.variant]

  for (let index = characters.length - 1; index > 0; index--) {
    const other = randomInt(index + 1)
    const candidate = characters[index]!
    characters[index] = characters[other]!
    characters[other] = candidate
  }

  // Try distinct characters before alternative poses of the same character.
  const candidates = variants
    .flatMap((variant) =>
      characters.map(
        ({ key }) => compileAppearanceManifest(authoredAppearance(key, variant)!).neutralUrl,
      ),
    )
    .filter((url) => !varyingCharacter || url !== baseUrl)
    .slice(0, NPC_VARIANT_POOL_LIMIT)
  const conflicts = new Set(
    candidates.length ? await findNpcAppearanceConflicts(actorUserId, candidates) : [],
  )
  const available = candidates.filter((url) => !conflicts.has(url))
  if (available.length < input.count)
    throw new AurevaneError(
      'INVALID_REQUEST',
      'There are too few unused looks for this race and gender. Allow more variation or request fewer candidates.',
    )

  return available.slice(0, input.count)
}
