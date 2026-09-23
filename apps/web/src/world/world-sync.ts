import type { WorldView } from './types'

export const WORLD_IDLE_REFRESH_MS = 4000
export const WORLD_BUSY_RETRY_MS = 250
export const WORLD_MIN_SCHEDULE_MS = 50
export const WORLD_SCHEDULE_CUSHION_MS = 75

type WorldSyncState = Pick<
  WorldView,
  'route' | 'nextStepAt' | 'serverNow' | 'movementBlocked'
>

export type WorldSyncPlan = {
  kind: 'refresh' | 'tick'
  delayMs: number
}

export function planWorldSync(
  view: WorldSyncState,
  elapsedSinceAcceptedMs: number,
): WorldSyncPlan {
  const moving =
    view.route.length > 0 && !view.movementBlocked && view.nextStepAt !== null

  if (!moving) return { kind: 'refresh', delayMs: WORLD_IDLE_REFRESH_MS }

  const elapsed = Number.isFinite(elapsedSinceAcceptedMs)
    ? Math.max(0, elapsedSinceAcceptedMs)
    : 0
  const untilDue = view.nextStepAt! - (view.serverNow + elapsed)

  return {
    kind: 'tick',
    delayMs: Math.max(
      WORLD_MIN_SCHEDULE_MS,
      Math.ceil(untilDue + WORLD_SCHEDULE_CUSHION_MS),
    ),
  }
}
