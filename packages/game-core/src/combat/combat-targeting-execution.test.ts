import { describe, expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  evaluateCombatAction,
  executeCombatAction,
  endCombatTurn,
  resolveCombatTargeting,
  type CombatActionDefinition,
  type CombatTargetSpec,
} from './actions'
import { selectCurrentFinalFacing } from './board'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
const target = (shape: CombatTargetSpec['shape']): CombatTargetSpec => ({
  geometryVersion: 2,
  kind: 'unit',
  teamPolicy: 'enemy',
  friendlyFire: 'enemies-only',
  shape,
  minimumRange: 0,
  maximumRange: shape.kind === 'line' ? shape.length : shape.kind === 'circle' ? shape.radius : 0,
  maximumElevationDifference: null,
  requiresLineOfSight: false,
})
const action = (shape: CombatTargetSpec['shape']): CombatActionDefinition => ({
  id: 'test.geometry',
  version: 1,
  sourceType: 'test',
  tags: [],
  requirements: [],
  cost: { mp: 0, spendsAction: false },
  target: target(shape),
  effects: [{ type: 'damage', recipient: 'affected-units', amount: 10, defenseKind: 'armor' }],
})
const east = { kind: 'direction', direction: 'east' } as const
const activate = { kind: 'activate' } as const
describe('authoritative targeting recipients', () => {
  it('hits all occupants in the complete lane, including beyond the nearest enemy', () => {
    const state = percentageDotEncounter()
    const cast = action({ kind: 'line', length: 3 })
    state.tactical.battle.combatants = state.tactical.battle.combatants.map((c) =>
      c.id === 'ally' ? { ...c, teamId: 'enemies' } : c,
    )
    state.tactical.placements = state.tactical.placements.map((p) =>
      p.combatantId === 'ally' ? { ...p, position: { x: 4, y: 1 } } : p,
    )
    const before = JSON.stringify(state)
    for (let i = 0; i < 3; i++) {
      const preview = evaluateCombatAction(state, cast, east, PV1F_COMBAT_CONTENT)
      expect(preview.legal).toBe(true)
      expect(preview.primaryCombatantId).toBeNull()
      expect(preview.affectedTiles).toEqual([
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
      ])
      expect(preview.affectedCombatantIds).toEqual(['ally', 'enemy', 'other'])
    }
    expect(JSON.stringify(state)).toBe(before)
    expect(
      executeCombatAction(state, cast, east, PV1F_COMBAT_CONTENT)
        .events.filter((e) => e.event === 'damage_applied')
        .map((e) => (e.event === 'damage_applied' ? e.targetCombatantId : '')),
    ).toEqual(['ally', 'enemy', 'other'])
  })
  it('resolves remote All enemies regardless of range or direction', () => {
    const state = percentageDotEncounter()
    state.tactical.placements = state.tactical.placements.map((p) =>
      p.combatantId === 'other' ? { ...p, position: { x: 4, y: 4 } } : p,
    )
    const result = resolveCombatTargeting(
      state,
      'actor',
      target({ kind: 'all' }),
      activate,
      PV1F_COMBAT_CONTENT,
    )
    expect(result.issues).toEqual([])
    expect(result.affectedCombatantIds).toEqual(['enemy', 'other'])
    expect(result.affectedTiles).toHaveLength(25)
  })
  it.each([
    ['ally', 'allies-only', ['actor', 'ally']],
    ['any', 'all-except-actor', ['ally', 'enemy', 'other']],
    ['self', 'all-units', ['actor']],
    ['enemy', 'allies-only', []],
  ] as const)(
    'intersects %s team policy with %s friendly fire',
    (teamPolicy, friendlyFire, expected) => {
      const spec = { ...target({ kind: 'all' }), teamPolicy, friendlyFire }
      expect(
        resolveCombatTargeting(
          percentageDotEncounter(),
          'actor',
          spec,
          activate,
          PV1F_COMBAT_CONTENT,
        ).affectedCombatantIds,
      ).toEqual(expected)
    },
  )
  it('keeps caster effects independent of the external Circle footprint', () => {
    const state = percentageDotEncounter()
    const cast = {
      ...action({ kind: 'circle', radius: 2 }),
      effects: [
        ...action({ kind: 'circle', radius: 2 }).effects,
        { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: -2 } as const,
      ],
    }
    const preview = evaluateCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT)
    expect(preview.legal).toBe(true)
    expect(preview.affectedTiles).not.toContainEqual({ x: 1, y: 1 })
    expect(preview.affectedCombatantIds).toEqual(['enemy', 'other'])
    expect(preview.projectedEffects).toContainEqual(
      expect.objectContaining({ combatantId: 'actor', effectType: 'resource-change' }),
    )
  })
  it('retains empty informational tiles but rejects attacks with no recipient', () => {
    const state = percentageDotEncounter()
    const cast = action({ kind: 'line', length: 3 })
    const north = { kind: 'direction', direction: 'north' } as const
    expect(
      resolveCombatTargeting(state, 'actor', cast.target, north, PV1F_COMBAT_CONTENT).affectedTiles,
    ).toEqual([{ x: 1, y: 0 }])
    const preview = evaluateCombatAction(state, cast, north, PV1F_COMBAT_CONTENT)
    expect(preview.legal).toBe(false)
    expect(preview.issues).toContainEqual(
      expect.objectContaining({ code: 'effect-target-missing' }),
    )
    expect(() => executeCombatAction(state, cast, north, PV1F_COMBAT_CONTENT)).toThrow()
  })
  it('allows empty All Ground terrain without inventing a primary unit', () => {
    const state = percentageDotEncounter()
    const cast = {
      ...action({ kind: 'all' }),
      target: { ...target({ kind: 'all' }), kind: 'ground-tile' as const },
      effects: [
        { type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' } as const,
      ],
    }
    const preview = evaluateCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT)
    expect(preview.legal).toBe(true)
    expect(preview.affectedTiles).toHaveLength(25)
    expect(
      executeCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT).state.terrainOverlays,
    ).toHaveLength(25)
  })
  it('filters individual elevation tiles without blocking later lane tiles', () => {
    const state = percentageDotEncounter()
    state.tactical.tiles = state.tactical.tiles.map((t) =>
      t.position.x === 2 && t.position.y === 1 ? { ...t, elevation: 3 } : t,
    )
    const cast = {
      ...action({ kind: 'line', length: 3 }),
      target: { ...target({ kind: 'line', length: 3 }), maximumElevationDifference: 1 },
    }
    const result = resolveCombatTargeting(state, 'actor', cast.target, east, PV1F_COMBAT_CONTENT)
    expect(result.affectedTiles).toEqual([
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ])
    expect(result.affectedCombatantIds).toEqual(['other'])
  })
  it('respects authored blocking terrain LoS while units do not block', () => {
    const state = percentageDotEncounter()
    state.tactical.terrains = [...state.tactical.terrains, { id: 'wall', traversalCost: null }]
    state.tactical.tiles = state.tactical.tiles.map((t) =>
      t.position.x === 2 && t.position.y === 1 ? { ...t, terrainId: 'wall' } : t,
    )
    const spec = { ...target({ kind: 'line', length: 3 }), requiresLineOfSight: true }
    expect(
      resolveCombatTargeting(state, 'actor', spec, east, PV1F_COMBAT_CONTENT).affectedTiles,
    ).toEqual([{ x: 2, y: 1 }])
    expect(
      resolveCombatTargeting(
        state,
        'actor',
        { ...spec, requiresLineOfSight: false },
        east,
        PV1F_COMBAT_CONTENT,
      ).affectedTiles,
    ).toHaveLength(3)
  })
  it('does not accept an aimed unit in place of a cardinal decision', () =>
    expect(
      evaluateCombatAction(
        percentageDotEncounter(),
        action({ kind: 'line', length: 3 }),
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      ).issues,
    ).toContainEqual(expect.objectContaining({ code: 'invalid-target-kind' })))
  it('captures delayed recipients through serialized turn boundaries after movement', () => {
    const state = {
      ...percentageDotEncounter(),
      effectTimingPolicy: { version: 1 as const, modes: { damage: 'next-round' as const } },
    }
    const cast = action({ kind: 'line', length: 3 })
    let next = executeCombatAction(state, cast, east, PV1F_COMBAT_CONTENT).state
    expect(next.pendingEffects).toHaveLength(1)
    next = JSON.parse(JSON.stringify(next))
    next.tactical.placements = next.tactical.placements.map((p) =>
      p.combatantId === 'other' ? { ...p, position: { x: 4, y: 4 } } : p,
    )
    for (let i = 0; i < 4; i++)
      next = endCombatTurn(
        { ...next, tactical: selectCurrentFinalFacing(next.tactical, 'east').state },
        PV1F_COMBAT_CONTENT,
      ).state
    expect(
      next.tactical.battle.combatants.filter((c) => c.teamId === 'enemies').map((c) => c.hp),
    ).toEqual([990, 990])
  })
  it('keeps area targeting able to hit Invisible while Single targeting stays blocked', () => {
    const state = percentageDotEncounter()
    state.statusState = state.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'invisible',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'enemy',
              },
            ],
          }
        : row,
    )
    expect(
      evaluateCombatAction(state, action({ kind: 'line', length: 3 }), east, PV1F_COMBAT_CONTENT)
        .affectedCombatantIds,
    ).toContain('enemy')
    const single = {
      ...action({ kind: 'single' }),
      target: { ...target({ kind: 'single' }), minimumRange: 1, maximumRange: 3 },
    }
    expect(
      evaluateCombatAction(
        state,
        single,
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      ).issues,
    ).toContainEqual(expect.objectContaining({ code: 'target-invisible' }))
  })
  it('excludes defeated recipients and fails closed after a terminal battle', () => {
    const state = percentageDotEncounter()
    state.tactical.battle.combatants = state.tactical.battle.combatants.map((c) =>
      c.id === 'other' ? { ...c, hp: 0 } : c,
    )
    expect(
      evaluateCombatAction(state, action({ kind: 'line', length: 3 }), east, PV1F_COMBAT_CONTENT)
        .affectedCombatantIds,
    ).toEqual(['enemy'])
    state.tactical.battle = { ...state.tactical.battle, lifecycle: 'abandoned', currentTurn: null }
    expect(
      evaluateCombatAction(state, action({ kind: 'all' }), activate, PV1F_COMBAT_CONTENT).issues,
    ).toContainEqual(expect.objectContaining({ code: 'battle-not-active' }))
  })
  it('queues one area status with all captured recipients and restores it at activation', () => {
    const state = {
      ...percentageDotEncounter(),
      effectTimingPolicy: { version: 1 as const, modes: {} },
    }
    const cast = {
      ...action({ kind: 'line', length: 3 }),
      effects: [
        {
          type: 'apply-status',
          recipient: 'affected-units',
          statusId: 'exposed',
          stacks: 1,
          durationTurns: 2,
        } as const,
      ],
    }
    let next = executeCombatAction(state, cast, east, PV1F_COMBAT_CONTENT).state
    expect(next.pendingEffects?.[0]?.recipientIds).toEqual(['enemy', 'other'])
    next = JSON.parse(JSON.stringify(next))
    for (let i = 0; i < 4; i++)
      next = endCombatTurn(
        { ...next, tactical: selectCurrentFinalFacing(next.tactical, 'east').state },
        PV1F_COMBAT_CONTENT,
      ).state
    expect(
      next.statusState
        .filter((row) => ['enemy', 'other'].includes(row.combatantId))
        .every((row) =>
          row.statuses.some((s) => s.statusId === 'exposed' && s.remainingOwnerTurnEnds === 2),
        ),
    ).toBe(true)
  })
})
