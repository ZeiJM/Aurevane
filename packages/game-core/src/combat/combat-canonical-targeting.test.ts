import { expect, it } from 'vitest'
import { resolveCombatTargeting, type CombatTargetSpec } from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import type { CombatOrdinaryTargetSelection } from './actions'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import {
  filterCombatTargetSpatialFootprint,
  resolveCombatTargetFootprint,
  maximumSupportedCombatRange,
} from './combat-targeting-shapes'
import { P2_7_TACTICAL_HALL_ARENAS } from './tactical-hall-arenas'
import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
} from './recruit-ai-build'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'

const target = (overrides: Partial<CombatTargetSpec> = {}): CombatTargetSpec => ({
  geometryVersion: 3,
  categories: ['enemy'],
  maximumSelections: 3,
  kind: 'unit',
  teamPolicy: 'enemy',
  friendlyFire: 'enemies-only',
  shape: { kind: 'single' },
  minimumRange: 0,
  maximumRange: 4,
  requiresLineOfSight: false,
  maximumElevationDifference: null,
  ...overrides,
})
function input() {
  const captured = captureCombatAbilitySource(
    source({
      targeting: { ...target(), maximumSelections: 3 },
      accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
      effects: [
        { id: 'hit', payload: { type: 'damage', recipient: 'affected-units', amount: 10 } },
        { id: 'recover', payload: { type: 'healing', recipient: 'actor', amount: 5 } },
      ],
    }),
  )
  const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    captured,
  ])
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: {
      kind: 'selections' as const,
      selections: [
        { kind: 'unit' as const, combatantId: 'enemy' },
        { kind: 'unit' as const, combatantId: 'other' },
      ],
    },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
}

it('captures and executes mixed Self/Enemy accuracy using current recipient categories', () => {
  const captured = captureCombatAbilitySource(
    source({
      targeting: {
        ...target({
          kind: 'self',
          teamPolicy: 'self',
          categories: ['self', 'enemy'],
          maximumSelections: 1,
        }),
        maximumSelections: 1,
      },
      accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
      effects: [
        { id: 'hit', payload: { type: 'damage', recipient: 'affected-units', amount: 10 } },
      ],
    }),
  )
  const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    captured,
  ])
  const command = {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
  expect(prepareCombatAbilityCommand(command).evaluation.legal).toBe(true)
  const result = commitCombatAbilityCommand(command)
  expect(result.events).toContainEqual(
    expect.objectContaining({ event: 'damage_applied', targetCombatantId: 'enemy' }),
  )
})

it('up_to_three_distinct_targets pays once and mixed_effect_recipients settle once per recipient', () => {
  const command = input()
  const quote = prepareCombatAbilityCommand(command)
  expect(quote.evaluation.legal).toBe(true)
  expect(quote.evaluation.affectedCombatantIds).toEqual(['enemy', 'other'])
  const committed = commitCombatAbilityCommand(command)
  expect(
    committed.state.tactical.battle.combatants
      .find((row) => row.id === 'actor')!
      .temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current,
  ).toBe(89)
  expect(
    committed.events
      .filter((event) => event.event === 'damage_applied')
      .map((event) => event.targetCombatantId),
  ).toEqual(['enemy', 'other'])
  expect(committed.events.filter((event) => event.event === 'healing_applied')).toHaveLength(1)
  for (const selections of [
    [command.selection.selections[0]!, command.selection.selections[0]!],
    [...command.selection.selections, { kind: 'unit', combatantId: 'ally' }, { kind: 'self' }],
  ] as readonly (readonly CombatOrdinaryTargetSelection[])[]) {
    const rejected = { ...command, selection: { kind: 'selections' as const, selections } }
    expect(prepareCombatAbilityCommand(rejected).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(rejected)).toThrow()
  }
})

it('self_is_not_ally and Ground has no fabricated primary', () => {
  const state = percentageDotEncounter()
  expect(
    resolveCombatTargeting(
      state,
      'actor',
      target({ categories: ['ally'], teamPolicy: 'ally', friendlyFire: 'allies-only' }),
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    ).issues.map((row) => row.code),
  ).toContain('target-team-not-allowed')
  expect(
    resolveCombatTargeting(
      state,
      'actor',
      target({ categories: ['ground'] }),
      { kind: 'tile', position: { x: 2, y: 1 } },
      PV1F_COMBAT_CONTENT,
    ).primaryCombatantId,
  ).toBeNull()
})

it('all_range_only_bypass independently respects elevation and LoS while historical_geometry2 retains its bypass', () => {
  const state = percentageDotEncounter()
  const tactical = {
    ...state.tactical,
    terrains: [...state.tactical.terrains, { id: 'wall', traversalCost: null }],
    tiles: state.tactical.tiles.map((tile) =>
      tile.position.x === 2 && tile.position.y === 1 ? { ...tile, terrainId: 'wall' } : tile,
    ),
  }
  const spec = target({
    shape: { kind: 'all' },
    maximumSelections: 1,
    maximumRange: 0,
    requiresLineOfSight: true,
  })
  const positions = resolveCombatTargetFootprint(tactical, { x: 1, y: 1 }, spec, {
    kind: 'activate',
  })
  expect(
    filterCombatTargetSpatialFootprint(tactical, { x: 1, y: 1 }, spec, positions),
  ).not.toContainEqual({ x: 3, y: 1 })
  expect(
    filterCombatTargetSpatialFootprint(
      tactical,
      { x: 1, y: 1 },
      { ...spec, geometryVersion: 2, categories: undefined, maximumSelections: undefined },
      positions,
    ),
  ).toContainEqual({ x: 3, y: 1 })
})

it('maximum_supported_map_range comes from the production arena registry Manhattan metric', () => {
  expect(maximumSupportedCombatRange()).toBe(
    Math.max(...P2_7_TACTICAL_HALL_ARENAS.map((arena) => arena.width - 1 + arena.height - 1)),
  )
  expect(maximumSupportedCombatRange()).toBe(20)
})

it.each([1, 2, 3])(
  'accepts %i distinct selections and rejects an illegal whole set without payment',
  (count) => {
    const command = input()
    const captured = captureCombatAbilitySource(
      source({
        ...command.root.source.definition.behaviors[0]!,
        targeting: { ...target(), categories: ['enemy', 'ally'], maximumSelections: 3 },
      }),
    )
    const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
      captured,
    ])
    const request = {
      ...command,
      state,
      root: { kind: 'canonical' as const, source: captured },
      context: combatAbilityCommandContext(state, captured),
      selection: {
        kind: 'selections' as const,
        selections: ['enemy', 'other', 'ally']
          .slice(0, count)
          .map((combatantId) => ({ kind: 'unit' as const, combatantId })),
      },
    }
    expect(prepareCombatAbilityCommand(request).evaluation.legal).toBe(true)
    const bad = {
      ...request,
      selection: {
        kind: 'selections' as const,
        selections: [
          ...request.selection.selections,
          { kind: 'unit' as const, combatantId: 'missing' },
        ],
      },
    }
    const before = JSON.stringify(state)
    expect(prepareCombatAbilityCommand(bad).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(bad)).toThrow()
    expect(JSON.stringify(state)).toBe(before)
  },
)

it('selected requirements aggregate every selected unit and do not invent a Ground subject', () => {
  const command = input()
  const behavior = command.root.source.definition.behaviors[0]!
  const captured = captureCombatAbilitySource(
    source({
      ...behavior,
      requirements: {
        kind: 'resource-state',
        subject: 'selected',
        resource: 'hp',
        comparison: 'at-least',
        basisPoints: 10000,
      },
    }),
  )
  let state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    captured,
  ])
  const request = {
    ...command,
    state,
    root: { kind: 'canonical' as const, source: captured },
    context: combatAbilityCommandContext(state, captured),
  }
  expect(prepareCombatAbilityCommand(request).evaluation.legal).toBe(true)
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((unit) =>
          unit.id === 'other' ? { ...unit, hp: 500 } : unit,
        ),
      },
    },
  }
  expect(
    prepareCombatAbilityCommand({ ...request, state }).evaluation.issues.map((row) => row.code),
  ).toContain('requirement-not-met')
})

it('Line clips walls but independent disabled LoS permits Steam; line_all_eligible and circle_inner_rings', () => {
  const state = percentageDotEncounter()
  const origin = { x: 1, y: 1 }
  const spec = target({
    shape: { kind: 'line', length: 3 },
    maximumSelections: 1,
    minimumRange: 0,
    maximumRange: 3,
  })
  const positions = resolveCombatTargetFootprint(state.tactical, origin, spec, {
    kind: 'direction',
    direction: 'east',
  })
  const steam = [{ kind: 'steam', position: { x: 2, y: 1 } }]
  expect(
    filterCombatTargetSpatialFootprint(state.tactical, origin, spec, positions, steam),
  ).toContainEqual({ x: 3, y: 1 })
  expect(
    filterCombatTargetSpatialFootprint(
      state.tactical,
      origin,
      { ...spec, requiresLineOfSight: true },
      positions,
      steam,
    ),
  ).not.toContainEqual({ x: 3, y: 1 })
  const wall = {
    ...state.tactical,
    terrains: [...state.tactical.terrains, { id: 'wall', traversalCost: null }],
    tiles: state.tactical.tiles.map((tile) =>
      tile.position.x === 2 && tile.position.y === 1 ? { ...tile, terrainId: 'wall' } : tile,
    ),
  }
  expect(filterCombatTargetSpatialFootprint(wall, origin, spec, positions)).toEqual([])
  expect(
    resolveCombatTargeting(
      state,
      'actor',
      spec,
      { kind: 'direction', direction: 'east' },
      PV1F_COMBAT_CONTENT,
    ).affectedCombatantIds,
  ).toEqual(['enemy', 'other'])
  const board = {
    ...state.tactical,
    width: 9,
    height: 9,
    tiles: Array.from({ length: 81 }, (_, i) => ({
      position: { x: i % 9, y: Math.floor(i / 9) },
      elevation: 0,
      terrainId: 'open',
    })),
  }
  for (const [radius, size] of [
    [1, 8],
    [2, 24],
  ])
    expect(
      resolveCombatTargetFootprint(
        board,
        { x: 4, y: 4 },
        target({
          shape: { kind: 'circle', radius: radius! },
          maximumSelections: 1,
          maximumRange: radius!,
        }),
        { kind: 'activate' },
      ),
    ).toHaveLength(size!)
})

it('actual captured Recruit AI selects and commits the plural set through the shared command', () => {
  const command = input()
  const state = reattachStatDrivenCombatBridge(command.state, percentageDotEncounter().statBridge)
  const before = JSON.stringify(state)
  const choice = chooseBuildAwareRecruitAiDecision({
    state,
    tieBreakSeed: 42,
    skillOptions: { committedSkills: [] },
  })
  expect(choice.intent.kind).toBe('action')
  if (choice.intent.kind !== 'action') throw new Error('action required')
  expect(choice.intent.target).toEqual(command.selection)
  expect(JSON.stringify(state)).toBe(before)
  const committed = executeBuildAwareRecruitAiAction(
    state,
    choice.intent.actionId,
    choice.intent.target,
    { committedSkills: [] },
    { behaviorId: choice.intent.behaviorId },
  )
  expect(
    committed.events
      .filter(
        (event): event is { event: 'damage_applied'; targetCombatantId: string } =>
          typeof event === 'object' &&
          event !== null &&
          'event' in event &&
          event.event === 'damage_applied',
      )
      .map((event) => event.targetCombatantId),
  ).toEqual(['enemy', 'other'])
  expect(
    committed.events.filter(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        'event' in event &&
        event.event === 'ap_spent',
    ),
  ).toHaveLength(1)
})

it.each([6, 15])(
  'previews and commits Line[%i] on a short board without off-board recipients',
  (length) => {
    const captured = captureCombatAbilitySource(
      source({
        targeting: {
          ...target({ shape: { kind: 'line', length }, minimumRange: 0, maximumRange: length }),
          maximumSelections: 1,
        },
        accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
        effects: [
          { id: 'hit', payload: { type: 'damage', recipient: 'affected-units', amount: 10 } },
        ],
      }),
    )
    const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
      captured,
    ])
    state.tactical.placements = state.tactical.placements.map((row) =>
      row.combatantId === 'ally' ? { ...row, position: { x: 4, y: 1 } } : row,
    )
    const before = JSON.stringify(state)
    const command = {
      state,
      actorId: 'actor',
      root: { kind: 'canonical' as const, source: captured },
      selection: { kind: 'direction' as const, direction: 'east' as const },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, captured),
    }
    const quote = prepareCombatAbilityCommand(command)
    expect(quote.evaluation.issues).toEqual([])
    expect(quote.evaluation.affectedTiles).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ])
    expect(quote.evaluation.affectedCombatantIds).toEqual(['enemy', 'other'])
    expect(JSON.stringify(state)).toBe(before)
    const committed = commitCombatAbilityCommand(command)
    expect(
      committed.events
        .filter((row) => row.event === 'damage_applied')
        .map((row) => row.targetCombatantId),
    ).toEqual(['enemy', 'other'])
  },
)

it.each([6, 15])(
  'retains explicit elevation filtering for Line[%i] without shortening the footprint',
  (length) => {
    const state = percentageDotEncounter()
    const tactical = {
      ...state.tactical,
      tiles: state.tactical.tiles.map((tile) =>
        tile.position.x === 3 && tile.position.y === 1 ? { ...tile, elevation: 3 } : tile,
      ),
    }
    const spec = target({
      shape: { kind: 'line', length },
      minimumRange: 0,
      maximumRange: length,
      maximumSelections: 1,
      maximumElevationDifference: 1,
    })
    const positions = resolveCombatTargetFootprint(tactical, { x: 1, y: 1 }, spec, {
      kind: 'direction',
      direction: 'east',
    })
    expect(positions).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ])
    expect(filterCombatTargetSpatialFootprint(tactical, { x: 1, y: 1 }, spec, positions)).toEqual([
      { x: 2, y: 1 },
      { x: 4, y: 1 },
    ])
  },
)

it.each([6, 15])('retains terrain and optional Steam visibility for Line[%i]', (length) => {
  const state = percentageDotEncounter()
  const origin = { x: 1, y: 1 }
  const spec = target({
    shape: { kind: 'line', length },
    minimumRange: 0,
    maximumRange: length,
    maximumSelections: 1,
  })
  const positions = resolveCombatTargetFootprint(state.tactical, origin, spec, {
    kind: 'direction',
    direction: 'east',
  })
  const steam = [{ kind: 'steam', position: { x: 2, y: 1 } }]
  expect(
    filterCombatTargetSpatialFootprint(state.tactical, origin, spec, positions, steam),
  ).toEqual(positions)
  expect(
    filterCombatTargetSpatialFootprint(
      state.tactical,
      origin,
      { ...spec, requiresLineOfSight: true },
      positions,
      steam,
    ),
  ).toEqual([{ x: 2, y: 1 }])
  const wall = {
    ...state.tactical,
    terrains: [...state.tactical.terrains, { id: 'wall', traversalCost: null }],
    tiles: state.tactical.tiles.map((tile) =>
      tile.position.x === 2 && tile.position.y === 1 ? { ...tile, terrainId: 'wall' } : tile,
    ),
  }
  expect(filterCombatTargetSpatialFootprint(wall, origin, spec, positions)).toEqual([])
})
