import type { CommitBattleIntentInput } from '@aurevane/db/battle-session'
import type { GridPosition } from '@aurevane/game-core/combat/board'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'

export interface BattleWalkReceipt {
  version: number
  combatantId: string
  path: readonly GridPosition[]
}

const RECENT_VERSIONS = 8
const MAX_WALK_POINTS = 21

function samePosition(a: GridPosition | undefined, b: GridPosition | undefined): boolean {
  return !!a && !!b && a.x === b.x && a.y === b.y
}

function walkPath(
  value: unknown,
  board: Pick<StatDrivenCombatEncounterState['tactical'], 'width' | 'height'>,
): GridPosition[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_WALK_POINTS) return null
  const path: GridPosition[] = []
  for (const point of value) {
    const previous = path.at(-1)
    if (
      !point ||
      !Number.isSafeInteger(point.x) ||
      !Number.isSafeInteger(point.y) ||
      point.x < 0 ||
      point.x >= board.width ||
      point.y < 0 ||
      point.y >= board.height ||
      (previous !== undefined &&
        Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y) !== 1)
    )
      return null
    path.push({ x: point.x, y: point.y })
  }
  return path
}

/** Capture only traversed, publicly visible walks whose endpoint survived settlement. */
export function snapshotWithBattleWalks(input: CommitBattleIntentInput): unknown {
  const snapshot = input.nextSnapshot as
    (StatDrivenCombatEncounterState & { recentWalks?: readonly BattleWalkReceipt[] }) | null
  const board = snapshot?.tactical
  if (!snapshot || !Array.isArray(board?.placements)) return input.nextSnapshot

  // The transactional repository advances one version per committed intent.
  const version = input.expectedBattleVersion + 1
  const walks = new Map<string, BattleWalkReceipt>()
  if (input.privacyJournal) {
    const journal = input.privacyJournal
    input.events.forEach((raw, eventIndex) => {
      const event = raw as Record<string, unknown> | null
      if (event?.event !== 'combatant_moved' || typeof event.combatantId !== 'string') return
      const visibility =
        journal.eventVisibilityOverrides.find((override) => override.eventIndex === eventIndex)
          ?.visibility ?? journal.commandVisibility
      if (visibility.kind !== 'public') return
      const path = walkPath(event.walkPath, board)
      if (path) walks.set(event.combatantId, { version, combatantId: event.combatantId, path })
    })
  }

  if (!snapshot.recentWalks?.length && walks.size === 0) return input.nextSnapshot
  const { recentWalks = [], ...state } = snapshot
  const nextWalks = new Map<string, BattleWalkReceipt[]>()
  for (const walk of recentWalks) {
    if (walk.version > version - RECENT_VERSIONS && walk.version < version) {
      const previous = nextWalks.get(walk.combatantId) ?? []
      previous.push(walk)
      nextWalks.set(walk.combatantId, previous)
    }
  }
  const retained = board.placements.flatMap(({ combatantId, position }) => {
    const walk = walks.get(combatantId)
    const previous = nextWalks.get(combatantId) ?? []
    const previousEndpoint = previous.at(-1)?.path.at(-1)
    if (!walk || !samePosition(walk.path.at(-1), position))
      return samePosition(previousEndpoint, position) ? previous : []
    return samePosition(previousEndpoint, walk.path[0]) ? [...previous, walk] : [walk]
  })
  return retained.length ? { ...state, recentWalks: retained } : state
}
