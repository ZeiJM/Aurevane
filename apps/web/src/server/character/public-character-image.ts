import 'server-only'

import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'

import { getStarterPortraitImageAssetId } from '@/media/character'
import { getImageAsset } from '@/media/registry'

export function resolvePublicCharacterImageUrl(
  profileImageUrl: string | null | undefined,
  portraitRef: string | null | undefined,
): string | null {
  const custom = profileImageUrl?.trim()
  if (custom) return custom
  if (!portraitRef || !isStarterCharacterPortraitRef(portraitRef)) return null

  return getImageAsset(getStarterPortraitImageAssetId(portraitRef)).src ?? null
}
