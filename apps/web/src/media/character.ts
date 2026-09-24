import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import {
  isStarterCharacterPortraitRef,
  STARTER_CHARACTER_PORTRAITS,
} from '@aurevane/game-core/character/starter-options'

import { getImageAsset, type ImageAssetId } from './registry'

const starterPortraitImageAssets = new Map<string, ImageAssetId>(
  STARTER_CHARACTER_PORTRAITS.map((option, index) => {
    const suffix = String(index + 1).padStart(2, '0')
    const assetId =
      index < 4
        ? `character.creation.square-portrait-${suffix}`
        : `character.creation.portrait-${suffix}`

    return [option.ref, assetId as ImageAssetId]
  }),
)

export function getStarterPortraitImageAssetId(portraitRef: CharacterPortraitRef): ImageAssetId {
  const assetId = starterPortraitImageAssets.get(portraitRef)
  if (!assetId) {
    throw new Error(`No registered profile image asset for portrait reference: ${portraitRef}`)
  }

  return assetId
}

export function resolveCharacterPortraitImageUrl(
  imageUrl: string | null | undefined,
  portraitRef: string | null | undefined,
): string | null {
  if (imageUrl) return imageUrl
  if (!portraitRef || !isStarterCharacterPortraitRef(portraitRef)) return null

  return getImageAsset(getStarterPortraitImageAssetId(portraitRef)).src ?? null
}
