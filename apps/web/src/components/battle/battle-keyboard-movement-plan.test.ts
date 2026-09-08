import { describe, expect, it } from 'vitest'

import {
  createKeyboardMovementPlan,
  keyboardMovementEndpoint,
  projectKeyboardMovementStep,
} from './battle-keyboard-movement-plan'

describe('keyboard movement projection stack', () => {
  it('retracts the last projected segment when the player steps back over it', () => {
    const origin = { x: 1, y: 1 }
    const first = projectKeyboardMovementStep(
      createKeyboardMovementPlan('1:1', origin),
      { x: 2, y: 1 },
    )
    const second = projectKeyboardMovementStep(first.plan, { x: 3, y: 1 })
    const backtrack = projectKeyboardMovementStep(second.plan, { x: 2, y: 1 })

    expect(first.kind).toBe('advance')
    expect(second.kind).toBe('advance')
    expect(backtrack.kind).toBe('backtrack')
    expect(backtrack.plan.path).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
    expect(keyboardMovementEndpoint(backtrack.plan)).toEqual({ x: 2, y: 1 })
  })

  it('truncates loops to the earlier projected tile instead of appending duplicates', () => {
    let plan = createKeyboardMovementPlan('1:1', { x: 1, y: 1 })
    plan = projectKeyboardMovementStep(plan, { x: 2, y: 1 }).plan
    plan = projectKeyboardMovementStep(plan, { x: 2, y: 2 }).plan
    plan = projectKeyboardMovementStep(plan, { x: 1, y: 2 }).plan

    const backtrack = projectKeyboardMovementStep(plan, { x: 1, y: 1 })

    expect(backtrack.kind).toBe('cancel')
    expect(backtrack.plan.path).toEqual([{ x: 1, y: 1 }])
  })

  it('keeps ordinary forward movement as a path append', () => {
    const plan = createKeyboardMovementPlan('0:0', { x: 0, y: 0 })
    const projected = projectKeyboardMovementStep(plan, { x: 0, y: 1 })

    expect(projected.kind).toBe('advance')
    expect(projected.plan.path).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ])
  })
})
