import { CREATION_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'
import { authoredAppearance, defaultAuthoredAppearance } from './appearance-authored-catalog'
import { appearanceGenderForIdentity, type AppearanceGender } from './appearance-gender'
import {
  appearanceManifestFromImageUrl,
  compileAppearanceManifest,
  type AppearanceBlueprint,
} from './appearance-manifest'

export function authoredPresentation(
  blueprint: AppearanceBlueprint | null | undefined,
  portraitRef?: string | null,
  initialGender?: AppearanceGender,
) {
  if (blueprint?.v === 7) return blueprint
  const starter = CREATION_CHARACTER_PORTRAITS.find(({ ref }) => ref === portraitRef)
  const gender =
    initialGender ??
    (blueprint && 'identity' in blueprint
      ? appearanceGenderForIdentity(blueprint.identity)
      : null) ??
    starter?.presentationId ??
    'feminine'
  const legacyRecipe = blueprint ? compileAppearanceManifest(blueprint).id : null
  const key = legacyRecipe ?? starter?.ref
  if (!key || (!legacyRecipe && starter?.ref.endsWith('-01')))
    return defaultAuthoredAppearance(gender)

  // The original four Human looks form a stable replacement set for saved portraits.
  // Adding new catalogue entries does not change an existing character's projected look.
  let hash = 0
  for (const letter of key) hash = (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0
  const number = String((hash % 4) + 1).padStart(4, '0')
  const presentation = gender === 'masculine' ? 'm' : 'f'
  return authoredAppearance(`human-${presentation}-${number}`, ((hash >>> 2) % 2) + 1)!
}

export function liveCharacterAppearanceUrl(
  imageUrl: string | null | undefined,
  portraitRef?: string | null,
  initialGender?: AppearanceGender,
) {
  const recipe = appearanceManifestFromImageUrl(imageUrl)?.blueprint
  return compileAppearanceManifest(authoredPresentation(recipe, portraitRef, initialGender))
    .neutralUrl
}
