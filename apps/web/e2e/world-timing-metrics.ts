import { STEP_MS } from '../src/world/catalog'
import { MAP_X, MAP_Y } from '../src/components/world/map-projection'

export interface PeerMotionSample {
  at: number
  frameAt: number
  x: number
  y: number
  tileSize: number
  identityRatio: number
}

// Positions are sampled on the renderer's animation clock. fillText's wall clock
// also includes callback delay and painting, which can change between frames.
// Two native-pixel rounding stages per axis bound the nameplate projection
// error; elapsed time permits only the fastest authored legal walking speed.
export function measurePeerMotionStep(previous: PeerMotionSample, current: PeerMotionSample) {
  for (const sample of [previous, current]) {
    if (
      !['at', 'frameAt', 'x', 'y', 'tileSize', 'identityRatio'].every((key) =>
        Number.isFinite(sample[key as keyof PeerMotionSample]),
      ) ||
      sample.frameAt < 0 ||
      sample.at < sample.frameAt ||
      sample.tileSize <= 0 ||
      sample.identityRatio <= 0
    )
      throw new Error('Invalid peer motion sample')
  }
  const elapsedMs = current.frameAt - previous.frameAt
  const paintElapsedMs = current.at - previous.at
  if (
    elapsedMs <= 0 ||
    paintElapsedMs <= 0 ||
    previous.tileSize !== current.tileSize ||
    previous.identityRatio !== current.identityRatio
  )
    throw new Error('Peer motion requires increasing clocks and a stable projection')
  const projectionError = (1 / MAP_X + 1 / MAP_Y) / (current.tileSize * current.identityRatio)
  return {
    elapsedMs,
    paintElapsedMs,
    deltaX: current.x - previous.x,
    deltaY: current.y - previous.y,
    projectionError,
    maximumDeltaX: elapsedMs / STEP_MS + projectionError,
  }
}

// Keep the complete delivery/click/draw/arrival sequence in observe. Approval
// is an additional required condition, never a prerequisite for a timed check.
export async function observeWorldMovement(
  walks: { click: Promise<void>; approval: Promise<void> }[],
  observe: () => Promise<void>,
) {
  await Promise.all([observe(), ...walks.flatMap((walk) => [walk.click, walk.approval])])
}
