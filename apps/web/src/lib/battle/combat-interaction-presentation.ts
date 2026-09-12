import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import {
  COMBAT_TERRAIN_OVERLAY_DETAILS,
  type CombatTerrainOverlay,
} from '@aurevane/game-core/combat/terrain-overlays'

export function gameplayStatusName(id: string): string {
  const alias = (
    { burn: 'Scorched', bleed: 'Bleeding', poison: 'Poisoned' } as Record<string, string>
  )[id]
  const name = combatStatusDetails(id).name
  return alias ? `${name} (${alias})` : name
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

/** Shared forecast and sanitized log text. Unknown payloads never become player-facing text. */
export function combatInteractionDescription(event: object): string | null {
  const data = event as Record<string, unknown>
  const position = tile(data.position)
  if (
    data.event === 'terrain_overlay_changed' &&
    position &&
    (data.after === 'frozen' || data.after === 'steam')
  ) {
    const details = COMBAT_TERRAIN_OVERLAY_DETAILS[data.after]
    const before =
      data.before === 'frozen' || data.before === 'steam'
        ? COMBAT_TERRAIN_OVERLAY_DETAILS[data.before].name
        : null
    const rounds = data.remainingRoundBoundaries
    if (rounds !== 1 && rounds !== 2) return null
    return `${before ? `${before} → ` : ''}${details.name} at tile ${position} · ${rounds} round ${rounds === 1 ? 'boundary' : 'boundaries'}. ${details.description}`
  }
  if (
    data.event === 'terrain_overlay_expired' &&
    position &&
    (data.kind === 'frozen' || data.kind === 'steam')
  ) {
    return `${COMBAT_TERRAIN_OVERLAY_DETAILS[data.kind].name} expired at tile ${position}; base terrain remains.`
  }
  if (data.event === 'combatant_displaced' && tile(data.from) && tile(data.to)) {
    return `Target pushed one tile: ${tile(data.from)} → ${tile(data.to)}. AP and Movement unchanged.`
  }
  if (
    data.event === 'displacement_failed' &&
    typeof data.reason === 'string' &&
    PUSH_FAILURES[data.reason]
  ) {
    return `Push failed: ${PUSH_FAILURES[data.reason]}; normal action costs apply, no refund.`
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
