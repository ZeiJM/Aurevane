// Test-only per-frame interpolation budget. Normal frames retain the existing
// 0.75 tile bound. Delayed drawing may cover more elapsed interpolation time,
// but even a delayed draw cannot justify teleporting by an entire tile.
const NOMINAL_FRAME_MS = 1000 / 60
const NORMAL_FRAME_LIMIT = 0.75
const TELEPORT_LIMIT = 0.95

export function measurePeerMotionStep(
  previous: { at: number; x: number },
  current: { at: number; x: number },
) {
  const elapsedMs = current.at - previous.at
  return {
    elapsedMs,
    deltaX: current.x - previous.x,
    maximumDeltaX: Math.min(
      TELEPORT_LIMIT,
      NORMAL_FRAME_LIMIT * Math.max(1, elapsedMs / NOMINAL_FRAME_MS),
    ),
  }
}
