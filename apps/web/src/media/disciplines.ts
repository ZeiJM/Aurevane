import {
  isFoundationDisciplineId,
  type FoundationDisciplineId,
} from '@aurevane/game-core/character/foundation-disciplines'

import { getImageAsset, type ImageAssetDescriptor, type ImageAssetId } from './registry'

const foundationDisciplineImageAssetIds = {
  vanguard: 'discipline.foundation.vanguard-sigil',
  farstrider: 'discipline.foundation.farstrider-sigil',
  shadehand: 'discipline.foundation.shadehand-sigil',
  ironfist: 'discipline.foundation.ironfist-sigil',
  aetherist: 'discipline.foundation.aetherist-sigil',
  lifebinder: 'discipline.foundation.lifebinder-sigil',
} as const satisfies Record<FoundationDisciplineId, ImageAssetId>

export function getFoundationDisciplineImageAsset(
  disciplineId: string,
): ImageAssetDescriptor | null {
  if (!isFoundationDisciplineId(disciplineId)) return null
  return getImageAsset(foundationDisciplineImageAssetIds[disciplineId])
}
