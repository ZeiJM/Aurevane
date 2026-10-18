import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { capturedBasicBattle } from './battle-basic-actions.test-utils'
import { buildMovementPaths, buildReachablePaths } from './battle-geometry'
import { evaluatePv1fMovement } from '@aurevane/game-core/combat/pv1f-action-economy'
import { projectBattleSnapshot } from '@/server/battle/battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'

it('uses the saved traversal price rather than today’s built-in 20 AP highlights', () => {
  const { view, state } = capturedBasicBattle()
  const actor = view.snapshot.tactical.placements.find((row) => row.combatantId === 'actor')!
  const paths = buildMovementPaths(view.snapshot, actor, 69)
  expect(paths.has('2:0')).toBe(false)
  expect(buildMovementPaths(view.snapshot, actor, 70).has('2:0')).toBe(true)
  for (const path of paths.values()) {
    const quote = evaluatePv1fMovement(state, path)
    expect(quote.movement.legal).toBe(true)
    expect(quote.economyCost).toBeLessThanOrEqual(69)
  }
})

it('keeps the saved entered-tile cap independent of spare AP', () => {
  const { view } = capturedBasicBattle('basic.recover', false, { apCost: 10, maximumTiles: 2 })
  const actor = view.snapshot.tactical.placements.find((row) => row.combatantId === 'actor')!
  const paths = buildMovementPaths(view.snapshot, actor, 100)
  expect(paths.has('2:0')).toBe(true)
  expect(paths.has('3:0')).toBe(false)
})

it('a disabled saved Move has no actionable highlighted destinations', () => {
  const { view } = capturedBasicBattle('basic.recover', false, { enabled: false })
  const actor = view.snapshot.tactical.placements.find((row) => row.combatantId === 'actor')!
  expect(buildMovementPaths(view.snapshot, actor, 100).size).toBe(0)
})

it('flat Move routes use one overall payment rather than a per-tile AP limit', () => {
  const { view } = capturedBasicBattle('basic.recover', false, {
    costBasis: 'flat',
    apCost: 100,
    maximumTiles: 4,
  })
  const actor = view.snapshot.tactical.placements.find((row) => row.combatantId === 'actor')!
  expect(buildMovementPaths(view.snapshot, actor, 99).size).toBe(0)
  expect(buildMovementPaths(view.snapshot, actor, 100).has('3:0')).toBe(true)
})

it('preserves the entered-tile cap when rough terrain changes AP consumption', () => {
  const { state } = capturedBasicBattle('basic.recover', false, { apCost: 10, maximumTiles: 2 })
  const rough = {
    ...state,
    tactical: {
      ...state.tactical,
      terrains: [...state.tactical.terrains, { id: 'rough', traversalCost: 2 }],
      tiles: state.tactical.tiles.map((tile) =>
        tile.position.y === 0 ? { ...tile, terrainId: 'rough' } : tile,
      ),
    },
  }
  const snapshot = projectBattleSnapshot(
    rough,
    deriveParticipantBattleViewerEntitlement(rough.tactical.battle.combatants, ['actor']),
  )
  const actor = snapshot.tactical.placements.find((row) => row.combatantId === 'actor')!
  const path = buildMovementPaths(snapshot, actor, 100).get('2:0')
  expect(path).toEqual([
    { x: 1, y: 1 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ])
  expect(evaluatePv1fMovement(rough, path!).movement.legal).toBe(true)
  expect(evaluatePv1fMovement(rough, path!).economyCost).toBe(40)
  expect(buildMovementPaths(snapshot, actor, 100).has('3:0')).toBe(false)
})

it('attached Move routes include walking in the overall payment and ignore disabled standalone Move', () => {
  const { view } = capturedBasicBattle('basic.recover', false, { enabled: false, apCost: 100 })
  const actor = view.snapshot.tactical.placements.find((row) => row.combatantId === 'actor')!
  const attached = {
    maximumTiles: 2,
    costs: [
      { resource: 'ap' as const, amount: 100 },
      { resource: 'mp' as const, amount: 2 },
    ],
  }
  const paths = buildReachablePaths(view.snapshot, actor, 100, Infinity, undefined, attached)
  expect(paths.has('2:0')).toBe(true)
  expect(paths.has('3:0')).toBe(false)
  expect(buildReachablePaths(view.snapshot, actor, 99, Infinity, undefined, attached).size).toBe(0)
})

it('attached Move highlights require the complete MP and nonlethal HP cost bundle', () => {
  const { view } = capturedBasicBattle()
  const actor = view.snapshot.tactical.placements.find((row) => row.combatantId === 'actor')!
  for (const costs of [
    [{ resource: 'mp' as const, amount: 21 }],
    [{ resource: 'hp' as const, amount: 1000 }],
  ])
    expect(
      buildReachablePaths(view.snapshot, actor, 100, Infinity, undefined, {
        maximumTiles: 2,
        costs,
      }).size,
    ).toBe(0)
})
