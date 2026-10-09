import { combatStatusPresentationTag } from '@aurevane/game-core/combat/gameplay-tags'
import {
  COMBAT_TERRAIN_OVERLAY_DETAILS,
  frozenGroundDescription,
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
  return `${details.name} terrain; ${rounds} round ${rounds === 1 ? 'boundary' : 'boundaries'} remaining; ${overlay.kind === 'frozen' ? frozenGroundDescription(overlay.frozenGroundPolicyVersion ?? null) : details.description}`
}

/** Compact inspect rows keep lifecycle; full rules remain in tile accessibility/help. */
export function terrainOverlaySummary(overlay: CombatTerrainOverlay | null | undefined): string {
  if (!overlay) return ''
  const rounds = overlay.remainingRoundBoundaries
  return `${COMBAT_TERRAIN_OVERLAY_DETAILS[overlay.kind].name} · ${rounds} ${rounds === 1 ? 'round' : 'rounds'} remaining`
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
  if (!Number.isSafeInteger(rounds) || (rounds as number) < 1 || (rounds as number) > 4) return null
  const details = COMBAT_TERRAIN_OVERLAY_DETAILS[projection.after]
  const before = projection.before ? COMBAT_TERRAIN_OVERLAY_DETAILS[projection.before].name : null
  const timing =
    projection.activationRound !== undefined ? `Starts round ${projection.activationRound} · ` : ''
  return `${timing}${before ? `${before} → ` : ''}${details.name} at tile ${position} · ${rounds} round ${rounds === 1 ? 'boundary' : 'boundaries'}. ${projection.after === 'frozen' ? frozenGroundDescription(projection.frozenGroundPolicyVersion ?? null) : details.description}`
}

/** Group actual projected/recorded changes; distinct transitions and timing remain separate. */
export function combatTerrainSummaries(
  projections: readonly CombatTerrainProjection[],
): readonly string[] {
  const groups = new Map<string, CombatTerrainProjection>()
  for (const projection of projections) {
    if (!combatTerrainProjectionDescription(projection)) continue
    const key = JSON.stringify([
      projection.before,
      projection.after,
      projection.remainingRoundBoundaries,
      projection.activationRound ?? null,
      projection.frozenGroundPolicyVersion ?? null,
    ])
    if (!groups.has(key)) groups.set(key, projection)
  }
  return [...groups.values()].map((projection) => {
    const after = projection.after as 'frozen' | 'steam'
    const details = COMBAT_TERRAIN_OVERLAY_DETAILS[after]
    const before = projection.before ? COMBAT_TERRAIN_OVERLAY_DETAILS[projection.before].name : null
    const rounds = projection.remainingRoundBoundaries
    return [
      `${before ? `${before} → ` : ''}${details.name}`,
      projection.activationRound !== undefined
        ? `Starts round ${projection.activationRound}`
        : null,
      `${rounds} ${rounds === 1 ? 'round' : 'rounds'}`,
      after === 'frozen'
        ? `+${COMBAT_TERRAIN_OVERLAY_DETAILS.frozen.additionalApPerTile} AP/tile`
        : 'Blocks line of sight',
    ]
      .filter(Boolean)
      .join(' · ')
  })
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
    if (!Number.isSafeInteger(rounds) || (rounds as number) < 1 || (rounds as number) > 4)
      return null
    return combatTerrainProjectionDescription({
      position: data.position as CombatTerrainProjection['position'],
      before: data.before === 'frozen' || data.before === 'steam' ? data.before : null,
      after: data.after,
      remainingRoundBoundaries: rounds as number,
      ...(data.frozenGroundPolicyVersion === 1 ? { frozenGroundPolicyVersion: 1 as const } : {}),
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
