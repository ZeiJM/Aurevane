import { parseVoidSectorId } from '@/world/void-realms'
import type { WorldSectorView } from '@/world/types'

/** Share only supplied adjacent cells of the same world; never join separate private maps. */
export function mapSceneDomain(sector: WorldSectorView) {
  if (sector.charted && sector.atlasColumn !== undefined && sector.atlasRow !== undefined)
    return 'atlas'
  const realm = parseVoidSectorId(sector.id)
  return realm ? `void:${realm.realmId}` : sector.id
}
