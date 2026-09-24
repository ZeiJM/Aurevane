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
  nextStepAt: number | null
  discoveries: Record<string, number[]>
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
  kind: 'settlement' | 'watchtower' | 'frontier' | 'anchor'
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
  attackable: boolean
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
export interface WorldView {
  characterId: string
  version: number
  serverNow: number
  position: WorldPosition
  route: TravelStep[]
  routeObjectiveId?: string | null
  nextStepAt: number | null
  sectors: WorldSectorView[]
  players: WorldPlayer[]
  objectives: WorldObjective[]
  interactions: WorldInteraction[]
  archive: WorldArchiveEntry[]
  battleSessionId: string | null
  movementBlocked: string | null
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
