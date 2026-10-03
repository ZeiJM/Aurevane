import { combatStatusPresentationTag } from '@aurevane/game-core/combat/gameplay-tags'
import {
  COMBAT_TERRAIN_OVERLAY_DETAILS,
  type CombatTerrainOverlay,
  type CombatTerrainProjection,
} from '@aurevane/game-core/combat/terrain-overlays'

export function gameplayStatusName(id: string): string {
  return combatStatusPresentationTag(id === 'lowered.guard' ? 'lowered-guard' : id)
}

export function terrainOverlayDescription(
  overlay: CombatTerrainOverlay | null | undefined,
): string {
  if (!overlay) return ''
  const details = COMBAT_TERRAIN_OVERLAY_DETAILS[overlay.kind]
  const rounds = overlay.remainingRoundBoundaries
  return `${details.name} terrain; ${rounds} round ${rounds === 1 ? 'boundary' : 'boundaries'} remaining; ${details.description}`
}

function tile(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const { x, y } = value as { x?: unknown; y?: unknown }
  return typeof x === 'number' &&
    Number.isSafeInteger(x) &&
    typeof y === 'number' &&
    Number.isSafeInteger(y)
    ? `${x + 1},${y + 1}`
    : null
}

const PUSH_FAILURES: Readonly<Record<string, string>> = {
  'status-restricted': 'Root prevents movement',
  'out-of-bounds': 'destination is outside the board',
  'blocked-terrain': 'destination is impassable',
  'occupied-tile': 'destination is occupied',
  'elevation-step-too-high': 'elevation exceeds Jump',
  'direction-undefined': 'no push direction',
  'target-defeated': 'target is defeated',
}

/** A forecast is a projection, never a fabricated history event. */
export function combatTerrainProjectionDescription(
  projection: CombatTerrainProjection,
): string | null {
  const position = tile(projection.position)
  if (!position || (projection.after !== 'frozen' && projection.after !== 'steam')) return null
  const rounds = projection.remainingRoundBoundaries
  if (rounds !== 1 && rounds !== 2) return null
  const details = COMBAT_TERRAIN_OVERLAY_DETAILS[projection.after]
  const before = projection.before ? COMBAT_TERRAIN_OVERLAY_DETAILS[projection.before].name : null
  const timing =
    projection.activationRound !== undefined ? `Starts round ${projection.activationRound} · ` : ''
  return `${timing}${before ? `${before} → ` : ''}${details.name} at tile ${position} · ${rounds} round ${rounds === 1 ? 'boundary' : 'boundaries'}. ${details.description}`
}

/** Shared forecast and sanitized log text. Unknown payloads never become player-facing text. */
export function combatInteractionDescription(event: object): string | null {
  const data = event as Record<string, unknown>
  const position = tile(data.position)
  if (
    data.event === 'terrain_overlay_changed' &&
    position &&
    (data.after === 'frozen' || data.after === 'steam')
  ) {
    const rounds = data.remainingRoundBoundaries
    if (rounds !== 1 && rounds !== 2) return null
    return combatTerrainProjectionDescription({
      position: data.position as CombatTerrainProjection['position'],
      before: data.before === 'frozen' || data.before === 'steam' ? data.before : null,
      after: data.after,
      remainingRoundBoundaries: rounds,
    })
  }
  if (
    data.event === 'terrain_overlay_expired' &&
    position &&
    (data.kind === 'frozen' || data.kind === 'steam')
  ) {
    return `${COMBAT_TERRAIN_OVERLAY_DETAILS[data.kind].name} expired at tile ${position}; base terrain remains.`
  }
  if (data.event === 'combatant_displaced' && tile(data.from) && tile(data.to)) {
    const verb = data.direction === 'pull' ? 'pulled' : 'pushed'
    const distance = data.distance ?? 1
    if (!Number.isSafeInteger(distance) || (distance as number) < 1) return null
    return `Target ${verb} ${distance === 1 ? 'one tile' : `${distance} tiles`}: ${tile(data.from)} → ${tile(data.to)}. AP and Movement unchanged.`
  }
  if (
    data.event === 'displacement_failed' &&
    typeof data.reason === 'string' &&
    PUSH_FAILURES[data.reason]
  ) {
    return `${data.direction === 'pull' ? 'Pull' : 'Push'} failed: ${PUSH_FAILURES[data.reason]}; normal action costs apply, no refund.`
  }
  if (data.event === 'status_removed' && typeof data.statusId === 'string') {
    return `${gameplayStatusName(data.statusId)} removed.`
  }
  return null
}

/** Older preview responses omit events; current responses describe actual unit recipients. */
export function statusWasProjected(
  statusId: string,
  events: readonly object[] | undefined,
): boolean {
  return (
    events === undefined ||
    events.some((event) => {
      const data = event as { event?: string; statusId?: string }
      return data.event === 'status_applied' && data.statusId === statusId
    })
  )
}
