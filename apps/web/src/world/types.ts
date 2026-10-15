import type { WorldEnvironment } from './environment'

export interface WorldPosition {
  sectorId: string
  x: number
  y: number
}
export interface TravelStep {
  position: WorldPosition
  durationMs: number
  road?: string
}
export type WorldObjectiveProgress = 'available' | 'active' | 'ready' | 'completed'
export interface WorldState {
  version: number
  position: WorldPosition
  route: TravelStep[]
  routeObjectiveId?: string | null
  /** Final target when a long journey continues beyond the saved route window. */
  routeDestination?: WorldPosition | null
  nextStepAt: number | null
  discoveries: Record<string, number[]>
  discoveredAnchors?: string[]
  completedObjectives: string[]
  objectiveProgress?: Record<string, WorldObjectiveProgress>
}
export interface WorldRegion {
  id: string
  name: string
  summary: string
  sector: string
  longitude: number
  latitude: number
  art: string
  color: string
}
export interface WorldRoad {
  from: WorldPosition
  to: WorldPosition
  durationMs: number
  name: string
}
export interface WorldLandmark {
  id: string
  name: string
  x: number
  y: number
  /** Original scenic landmark sprite; does not grant an interaction or reward. */
  sceneryIndex?: number
  kind:
    | 'settlement'
    | 'watchtower'
    | 'frontier'
    | 'anchor'
    | 'shrine'
    | 'ruin'
    | 'camp'
    | 'grove'
    | 'spring'
    | 'hamlet'
    | 'waystone'
    | 'marketplace'
    | 'bridge'
}
export interface WorldBuilding {
  id: string
  x: number
  y: number
  width: number
  height: number
  artIndex: number
  propIndex?: number
}
export interface WorldAtlasCell {
  id: string
  name: string
  coordinate: string
  regionId: string
  column: number
  row: number
  charted: boolean
  /** Public district identity; absent for private or non-town terrain. */
  townId?: string
  /** Public water/lava only: row-major 13x9 '~', 'l' or '.'; omitted when dry. */
  waterTiles?: string
}
export interface WorldSector {
  id: string
  name: string
  coordinate: string
  regionId: string
  art: string | null
  panorama?: string
  stepMs?: number
  east: number
  north: number
  rows: readonly string[]
  charted: boolean
  /** Deterministically generated ground between and beyond the authored regions. */
  generated?: boolean
  atlasColumn?: number
  atlasRow?: number
  townId?: string
  landscape?: 'sakura' | 'autumn' | 'wisteria' | 'willow' | 'wildflowers'
  buildings?: readonly WorldBuilding[]
  landmarks: readonly WorldLandmark[]
  roads: readonly WorldRoad[]
}
export interface WorldObjective {
  id: string
  name: string
  description: string
  kind: 'quest' | 'event'
  autoPath: boolean
  guidance: 'exact' | 'clue'
  destination: WorldPosition | null
  completed: boolean
  progress?: WorldObjectiveProgress
}
export interface WorldInteraction {
  id: string
  objectiveId: string
  title: string
  speaker: string
  body: string
  actionLabel: string | null
  progress: WorldObjectiveProgress
}
export interface WorldAnchorDiscovery {
  id: string
  name: string
  sectorId: string
}
export interface WorldArchiveEntry {
  id: string
  kind: 'field-observation'
  title: string
  location: string
  summary: string
  provenance: string
}
export interface WorldPlayer {
  characterId: string
  name: string
  level: number
  portraitRef: string
  imageUrl: string | null
  position: WorldPosition
  /** Seen in the World within the last 40 seconds. Absent on historical payloads. */
  online?: boolean
  attackable: boolean
  /** Public encounter eligibility before proximity; atomic server checks still decide attacks. */
  attackEligible?: boolean
  entityKind?: 'player' | 'ai'
  /** Bounded public prefix of approved travel; never authoritative for range. */
  movement?: {
    version: number
    serverNow: number
    nextStepAt: number | null
    route: TravelStep[]
  }
}
export interface WorldCell {
  x: number
  y: number
  terrain: string
  walkable: boolean
  safe: boolean
}
export interface WorldSectorView extends Omit<WorldSector, 'rows' | 'roads'> {
  cells: WorldCell[]
  exits: WorldRoad[]
}
/** Public presentation only: no private cells, roads, peers or interactions. */
export type WorldScenerySector = readonly [
  sectorId: string,
  terrain: string,
  landscape: WorldSector['landscape'] | null,
  buildings: readonly WorldBuilding[],
  landmarks: readonly WorldLandmark[],
]
export interface WorldView {
  /** Service registration and private receive capability are available for this scene. */
  livePresence?: boolean
  characterId: string
  version: number
  serverNow: number
  position: WorldPosition
  route: TravelStep[]
  routeObjectiveId?: string | null
  routeDestination?: WorldPosition | null
  nextStepAt: number | null
  sectors: WorldSectorView[]
  /** Compact public terrain buffer, independent of the authorized presence scene. */
  scenery?: WorldScenerySector[]
  /** Compact overview; private terrain and undiscovered landmarks never enter this list. */
  atlas?: WorldAtlasCell[]
  players: WorldPlayer[]
  objectives: WorldObjective[]
  interactions: WorldInteraction[]
  anchors: WorldAnchorDiscovery[]
  archive: WorldArchiveEntry[]
  battleSessionId: string | null
  movementBlocked: string | null
  /** Server-owned day/night clock and weather, identical for every player. */
  environment: WorldEnvironment
}
export type WorldIntent =
  | { kind: 'walk'; destination: WorldPosition }
  | { kind: 'autopath'; objectiveId: string }
  | { kind: 'stop' }
  | { kind: 'tick' }
  | { kind: 'cross' }
  | { kind: 'interact'; interactionId: string }
  | { kind: 'attack'; targetId: string }
export interface WorldCommand {
  characterId: string
  expectedVersion: number
  commandId: string
  intent: WorldIntent
}
