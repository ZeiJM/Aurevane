import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'

import type { ImageAssetId } from './registry'

const starterPortraitImageAssets = new Map<string, ImageAssetId>(
  STARTER_CHARACTER_PORTRAITS.map((option, index) => [
    option.ref,
    `character.creation.portrait-${String(index + 1).padStart(2, '0')}` as ImageAssetId,
  ]),
)

export function getStarterPortraitImageAssetId(portraitRef: CharacterPortraitRef): ImageAssetId {
  const assetId = starterPortraitImageAssets.get(portraitRef)
  if (!assetId) {
    throw new Error(`No registered profile image asset for portrait reference: ${portraitRef}`)
  }

  return assetId
}
