import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'

import type { ImageAssetId } from './registry'

const starterPortraitImageAssets = new Map<string, ImageAssetId>([
  ['portrait.starter.wayfarer-01', 'character.creation.portrait-01'],
  ['portrait.starter.wayfarer-02', 'character.creation.portrait-02'],
  ['portrait.starter.wayfarer-03', 'character.creation.portrait-03'],
  ['portrait.starter.wayfarer-04', 'character.creation.portrait-04'],
])

export function getStarterPortraitImageAssetId(portraitRef: CharacterPortraitRef): ImageAssetId {
  const assetId = starterPortraitImageAssets.get(portraitRef)
  if (!assetId) {
    throw new Error(`No registered profile image asset for portrait reference: ${portraitRef}`)
  }

  return assetId
}
