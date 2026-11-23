import { parseVoidSectorId } from '@/world/void-realms'
import type { WorldSectorView } from '@/world/types'

// Identity allowlist only; no private terrain or unseen addresses are imported.
const legacyUnchartedIds = new Set([
  'uncharted-glass',
  'uncharted-belfry',
  'uncharted-pale',
  'uncharted-orchard',
  'uncharted-landing',
  'uncharted-mirrors',
  'uncharted-cinders',
  'uncharted-verge',
  'uncharted-tarn',
  'uncharted-spiral',
  'uncharted-geodes',
  'uncharted-shale',
  'uncharted-relic',
])

function isLegacyUnchartedScene(sector: WorldSectorView) {
  const { sceneColumn: column, sceneRow: row } = sector
  if (
    sector.charted ||
    column === undefined ||
    row === undefined ||
    !Number.isInteger(column) ||
    !Number.isInteger(row) ||
    column < 0 ||
    column >= 64 ||
    row < 0 ||
    row >= 48
  )
    return false
  if (legacyUnchartedIds.has(sector.id)) return true
  const match = /^uncharted-expanse:(0|[1-9][0-9]?):(0|[1-9][0-9]?)$/.exec(sector.id)
  if (!match || match[0] !== sector.id) return false
  return Number(match[1]) === column && Number(match[2]) === row
}

/** Share only supplied adjacent cells of the same world; never join separate private maps. */
export function mapSceneDomain(sector: WorldSectorView) {
  if (sector.charted && sector.atlasColumn !== undefined && sector.atlasRow !== undefined)
    return 'atlas'
  if (isLegacyUnchartedScene(sector)) return 'uncharted:legacy'
  const realm = parseVoidSectorId(sector.id)
  return realm ? `void:${realm.realmId}` : sector.id
}
