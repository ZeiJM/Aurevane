export interface KeyboardMovementPosition {
  x: number
  y: number
}

export interface KeyboardMovementPlan {
  committedOriginKey: string
  path: readonly KeyboardMovementPosition[]
}

export type KeyboardMovementProjection =
  | { kind: 'advance'; plan: KeyboardMovementPlan }
  | { kind: 'backtrack'; plan: KeyboardMovementPlan }
  | { kind: 'cancel'; plan: KeyboardMovementPlan }

export function createKeyboardMovementPlan(
  committedOriginKey: string,
  origin: KeyboardMovementPosition,
): KeyboardMovementPlan {
  return { committedOriginKey, path: [{ ...origin }] }
}

export function keyboardMovementEndpoint(
  plan: KeyboardMovementPlan,
): KeyboardMovementPosition {
  const endpoint = plan.path[plan.path.length - 1]
  if (!endpoint) throw new Error('Keyboard movement plan requires an origin.')
  return endpoint
}

export function projectKeyboardMovementStep(
  plan: KeyboardMovementPlan,
  target: KeyboardMovementPosition,
): KeyboardMovementProjection {
  const existingIndex = findPositionIndex(plan.path, target)
  if (existingIndex >= 0) {
    const path = plan.path.slice(0, existingIndex + 1).map(copyPosition)
    const nextPlan = { ...plan, path }
    return existingIndex === 0
      ? { kind: 'cancel', plan: nextPlan }
      : { kind: 'backtrack', plan: nextPlan }
  }

  return {
    kind: 'advance',
    plan: { ...plan, path: [...plan.path.map(copyPosition), copyPosition(target)] },
  }
}

function findPositionIndex(
  path: readonly KeyboardMovementPosition[],
  target: KeyboardMovementPosition,
): number {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const candidate = path[index]
    if (candidate && candidate.x === target.x && candidate.y === target.y) return index
  }
  return -1
}

function copyPosition(position: KeyboardMovementPosition): KeyboardMovementPosition {
  return { x: position.x, y: position.y }
}
