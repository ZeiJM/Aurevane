import { issueCommittedCombatExecution } from './combat-committed-execution'
import { expect, it } from 'vitest'
import {
  evaluateCombatAction,
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatTargetSelection,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { deriveSharedEffectAim, withAuthoredEffectTarget } from './combat-effect-target-authoring'
import type { CombatEffectTarget } from './combat-effect-recipients'
import { selectCurrentFinalFacing } from './board'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  primeCombatControlledAbility,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand } from './combat-ability-command'
import { preparePv1fTurnEconomy } from './pv1f-action-economy'
const content = { statuses: [] }
const position = (state: CombatEncounterState, id: string) =>
  state.tactical.placements.find((row) => row.combatantId === id)!.position
function moved(state: CombatEncounterState, ids: readonly string[]): CombatEncounterState {
  return {
    ...state,
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements.map((row) =>
        ids.includes(row.combatantId)
          ? { ...row, position: { x: row.position.x, y: row.position.y + 2 } }
          : row,
      ),
    },
  }
}
function action(target: CombatEffectTarget): CombatActionDefinition {
  const effects = [
    withAuthoredEffectTarget(
      {
        type: 'return-to-turn-start' as const,
        recipient: 'actor' as const,
        anchorMode: 'cast-position' as const,
      },
      target,
    ),
  ]
  return {
    id: 'test.rewind',
    version: 1,
    sourceType: 'test',
    tags: [],
    requirements: [],
    cost: { spendsAction: false, mp: 2 },
    effects,
    target: deriveSharedEffectAim(
      {
        kind: 'unit',
        teamPolicy: 'any',
        friendlyFire: 'all-units',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 2,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
      },
      effects,
    ),
    effectTimingModes: ['delayed'],
  }
}
function advance(state: CombatEncounterState) {
  const round = state.tactical.battle.round
  while (state.tactical.battle.round === round)
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      content,
    ).state
  return JSON.parse(JSON.stringify(state)) as CombatEncounterState
}
it.each([
  ['self', { kind: 'self' }, ['actor']],
  ['ally', { kind: 'unit', combatantId: 'ally' }, ['ally']],
  ['enemy', { kind: 'unit', combatantId: 'enemy' }, ['enemy']],
  ['anyone', { kind: 'unit', combatantId: 'enemy' }, ['enemy']],
  ['all', { kind: 'self' }, ['actor', 'ally', 'enemy', 'other']],
] as const)(
  '%s captures each recipient own position before movement and restores after reload',
  (target, selection, ids) => {
    const initial = { ...percentageDotEncounter(), effectTimingPolicy: { version: 2, modes: {} } }
    const before = JSON.stringify(initial)
    const cast = action(target)
    expect(evaluateCombatAction(initial, cast, selection, content).legal).toBe(true)
    expect(JSON.stringify(initial)).toBe(before)
    const pending = executeCombatAction(initial, cast, selection, content)
    expect(pending.state.pendingEffects?.[0]?.recipientIds).toEqual([...ids].sort())
    let state = moved(pending.state, ids)
    expect(validateCombatEncounterState(state)).toEqual([])
    state = advance(advance(state))
    for (const id of ids) expect(position(state, id)).toEqual(position(initial, id))
    expect(state.tactical.battle.combatants[0]!.mp).toBe(
      initial.tactical.battle.combatants[0]!.mp - 2,
    )
    expect(state.pendingEffects).toHaveLength(0)
  },
)
it('does not capture or pay for an out-of-range cast', () => {
  const state = percentageDotEncounter(),
    cast = action('enemy')
  cast.target = { ...cast.target, maximumRange: 1 }
  expect(
    evaluateCombatAction(state, cast, { kind: 'unit', combatantId: 'other' }, content).legal,
  ).toBe(false)
  expect(() =>
    executeCombatAction(state, cast, { kind: 'unit', combatantId: 'other' }, content),
  ).toThrow()
  expect(state.pendingEffects ?? []).toEqual([])
})
it('a blocked All recipient does not block other captured returns', () => {
  const initial = { ...percentageDotEncounter(), effectTimingPolicy: { version: 2, modes: {} } }
  let state = moved(executeCombatAction(initial, action('all'), { kind: 'self' }, content).state, [
    'actor',
    'ally',
    'enemy',
    'other',
  ])
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements.map((row) =>
        row.combatantId === 'other' ? { ...row, position: position(initial, 'enemy') } : row,
      ),
    },
  }
  state = advance(advance(state))
  expect(position(state, 'enemy')).toEqual({ x: 2, y: 3 })
  expect(position(state, 'actor')).toEqual(position(initial, 'actor'))
  expect(position(state, 'ally')).toEqual(position(initial, 'ally'))
})
it('Controlled prime requires a legal selected target and never replaces its captured recipient', () => {
  const cast = action('enemy')
  const captured = captureCombatAbilitySource({
    ...source({
      classification: 'utility',
      attackFamily: undefined,
      targeting: { ...cast.target, maximumSelections: 1 },
      effects: [
        {
          id: 'rewind',
          timing: 'controlled',
          payload: {
            type: 'return-to-turn-start',
            recipient: 'affected-units',
            target: 'enemy',
            anchorMode: 'cast-position',
          },
        },
      ],
    }),
    tags: [],
  })
  const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    captured,
  ])
  const input = {
    state,
    actorId: 'actor',
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: 'strike',
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content,
  }
  const invalid = { ...input, selection: { kind: 'unit' as const, combatantId: 'other' } }
  invalid.state = {
    ...state,
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements.map((row) =>
        row.combatantId === 'other' ? { ...row, position: { x: 4, y: 4 } } : row,
      ),
    },
  }
  expect(() => primeCombatControlledAbility(invalid)).toThrow(/target|range|selection/i)
  const primed = primeCombatControlledAbility(input).state
  const later = moved(primed, ['enemy'])
  const command = (selection: CombatTargetSelection) => ({
    state: later,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection,
    content,
    context: combatAbilityCommandContext(later, captured),
  })
  expect(() =>
    commitCombatAbilityCommand(command({ kind: 'unit', combatantId: 'other' })),
  ).toThrow()
  const released = commitCombatAbilityCommand(command(input.selection))
  expect(position(released.state, 'enemy')).toEqual(position(state, 'enemy'))
  expect(position(released.state, 'actor')).toEqual(position(state, 'actor'))
})

it.each(['missing', 'extra', 'foreign', 'fraction', 'offboard', 'extra-coordinate'] as const)(
  'rejects %s recipient anchor data after JSON restore',
  (fault) => {
    const state = executeCombatAction(
      { ...percentageDotEncounter(), effectTimingPolicy: { version: 2, modes: {} } },
      action('enemy'),
      { kind: 'unit', combatantId: 'enemy' },
      content,
    ).state
    const saved = JSON.parse(JSON.stringify(state)) as CombatEncounterState
    const pending = saved.pendingEffects![0]!
    const good = { enemy: { x: 2, y: 1 } }
    const anchors =
      fault === 'missing'
        ? {}
        : fault === 'extra'
          ? { ...good, ally: { x: 1, y: 2 } }
          : fault === 'foreign'
            ? { stranger: { x: 2, y: 1 } }
            : fault === 'fraction'
              ? { enemy: { x: 2.5, y: 1 } }
              : fault === 'offboard'
                ? { enemy: { x: 25, y: 1 } }
                : { enemy: { x: 2, y: 1, z: 0 } }
    saved.pendingEffects = [
      { ...pending, returnAnchors: anchors as NonNullable<typeof pending.returnAnchors> },
    ]
    expect(validateCombatEncounterState(saved)).toContainEqual(
      expect.objectContaining({ field: 'pendingEffects' }),
    )
  },
)
it('captures a Resonance automatic result recipient through the canonical path', () => {
  const reaction = captureCombatAbilitySource({
    ...source(
      {
        id: 'return',
        activation: 'automatic',
        classification: 'utility',
        attackFamily: undefined,
        costs: [],
        activationLimits: ['once-per-action'],
        requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
        automaticTarget: { subject: 'triggering' },
        targeting: { ...action('anyone').target, maximumSelections: 1 },
        effects: [
          {
            id: 'rewind',
            timing: 'delayed',
            payload: {
              type: 'return-to-turn-start',
              recipient: 'affected-units',
              target: 'anyone',
              anchorMode: 'cast-position',
            },
          },
        ],
      },
      'reaction',
    ),
    ownerCombatantId: 'enemy',
    abilityId: 'resonance.rewind',
    sourceKind: 'resonance',
    tags: [],
  })
  const initial = reconcileCombatAbilitySources(
    preparePv1fTurnEconomy({
      ...percentageDotEncounter(),
      effectTimingPolicy: { version: 2, modes: {} },
    }),
    [reaction],
  )
  const cast: CombatActionDefinition = {
    ...action('self'),
    effects: [{ type: 'healing', recipient: 'actor', amount: 1 }],
    effectTimingModes: ['instant'],
  }
  const committed = commitCombatAbilityCommand({
    state: initial,
    actorId: 'actor',
    root: {
      kind: 'native',
      action: cast,
      sourceInstanceId: 'native',
      classification: 'utility',
      costs: [],
    },
    selection: { kind: 'self' },
    content,
    context: combatAbilityCommandContext(initial, reaction),
  })
  expect(committed.state.pendingEffects).toContainEqual(
    expect.objectContaining({
      actionId: 'resonance.rewind',
      recipientIds: ['actor'],
      returnAnchors: { actor: position(initial, 'actor') },
    }),
  )
  const restored = advance(advance(moved(committed.state, ['actor'])))
  expect(position(restored, 'actor')).toEqual(position(initial, 'actor'))
})
it('keeps authenticated pre-reaction anchors when live recipient position changes before native settlement', () => {
  const cast = action('enemy'),
    initial = { ...percentageDotEncounter(), effectTimingPolicy: { version: 2, modes: {} } }
  const captured = captureCombatAbilitySource(source())
  const context = combatAbilityCommandContext(initial, captured)
  const selection = { kind: 'unit' as const, combatantId: 'enemy' }
  const committedExecution = issueCommittedCombatExecution(
    initial,
    'actor',
    cast,
    selection,
    context,
    true,
    undefined,
    undefined,
    { enemy: { x: 2, y: 1 } },
  )
  const later = {
    ...initial,
    tactical: {
      ...initial.tactical,
      placements: initial.tactical.placements.map((row) =>
        row.combatantId === 'enemy' ? { ...row, position: { x: 2, y: 2 } } : row,
      ),
    },
  }
  const committed = executeCombatAction(later, cast, selection, content, {
    ...context,
    committedExecution,
  })
  expect(committed.state.pendingEffects![0]!.returnAnchors).toEqual({ enemy: { x: 2, y: 1 } })
  expect(() =>
    executeCombatAction(later, cast, selection, content, { ...context, committedExecution }),
  ).toThrow(/authority/)
})

it('the Recruit command bridge carries the legal selected recipient when priming Rewind', async () => {
  const { executeBuildAwareRecruitAiAction } = await import('./recruit-ai-build')
  const { reattachStatDrivenCombatBridge } = await import('./stat-driven-combat')
  const cast = action('enemy')
  const captured = captureCombatAbilitySource({
    ...source({
      classification: 'utility',
      attackFamily: undefined,
      targeting: { ...cast.target, maximumSelections: 1 },
      effects: [
        {
          id: 'rewind',
          timing: 'controlled',
          payload: {
            type: 'return-to-turn-start',
            recipient: 'affected-units',
            target: 'enemy',
            anchorMode: 'cast-position',
          },
        },
      ],
    }),
    tags: [],
  })
  const initial = preparePv1fTurnEconomy(percentageDotEncounter())
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(initial, [captured]),
    initial.statBridge,
  )
  const primed = executeBuildAwareRecruitAiAction(
    state,
    captured.abilityId,
    { kind: 'unit', combatantId: 'enemy' },
    { canonicalSources: [captured] },
    { behaviorId: 'strike', controlledOperation: 'prime' },
  )
  expect(primed.state.abilityRuntime!.controlled!.primes[0]!.returnAnchors).toEqual({
    enemy: { x: 2, y: 1 },
  })
})

it.each(['rooted', 'impassable', 'elevation', 'defeated'] as const)(
  'rechecks each recipient own %s state when a delayed return activates',
  (reason) => {
    const catalog = {
      statuses: [
        {
          id: 'test.root',
          version: 1,
          maximumStacks: 1,
          durationOwnerTurnStarts: 10,
          damageTakenMultiplierBasisPoints: 10000,
          movement: { blocked: true },
        },
      ],
    }
    const base = percentageDotEncounter()
    const initial = {
      ...base,
      statBalancePolicyVersion: 1 as const,
      statBridge: {
        ...base.statBridge,
        rulesVersion: 4,
        combatants: base.statBridge.combatants.map((profile) => ({
          ...profile,
          level: 1,
          criticalChance: 0,
          statusResistance: 0,
        })),
      },
      effectTimingPolicy: { version: 2, modes: {} },
    }
    let state = moved(
      executeCombatAction(initial, action('all'), { kind: 'self' }, catalog).state,
      ['actor', 'ally', 'enemy', 'other'],
    )
    if (reason === 'rooted')
      state = {
        ...state,
        statusState: state.statusState.map((row) =>
          row.combatantId === 'enemy'
            ? {
                ...row,
                statuses: [
                  {
                    statusId: 'test.root',
                    statusVersion: 1,
                    stacks: 1,
                    sourceCombatantId: 'actor',
                    remainingOwnerTurnStarts: 10,
                  },
                ],
              }
            : row,
        ),
      }
    if (reason === 'impassable')
      state = {
        ...state,
        tactical: {
          ...state.tactical,
          terrains: [{ id: 'blocked', traversalCost: null }, ...state.tactical.terrains],
          tiles: state.tactical.tiles.map((tile) =>
            tile.position.x === 2 && tile.position.y === 1
              ? { ...tile, terrainId: 'blocked' }
              : tile,
          ),
        },
      }
    if (reason === 'elevation')
      state = {
        ...state,
        tactical: {
          ...state.tactical,
          tiles: state.tactical.tiles.map((tile) =>
            tile.position.x === 2 && tile.position.y === 1 ? { ...tile, elevation: 1 } : tile,
          ),
        },
      }
    if (reason === 'defeated')
      state = {
        ...state,
        tactical: {
          ...state.tactical,
          battle: {
            ...state.tactical.battle,
            combatants: state.tactical.battle.combatants.map((unit) =>
              unit.id === 'enemy' ? { ...unit, hp: 0 } : unit,
            ),
          },
        },
      }
    const events: unknown[] = []
    while (state.tactical.battle.round < 3) {
      const next = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        catalog,
      )
      state = JSON.parse(JSON.stringify(next.state)) as CombatEncounterState
      events.push(...next.events)
    }
    expect(position(state, 'enemy')).toEqual({ x: 2, y: 3 })
    expect(position(state, 'actor')).toEqual(position(initial, 'actor'))
    if (reason !== 'defeated')
      expect(events).toContainEqual(
        expect.objectContaining({
          event: 'combatant_rewind_blocked',
          combatantId: 'enemy',
          reason,
        }),
      )
    expect(state.pendingEffects).toHaveLength(0)
  },
)

it('retains historical explicit Self turn-origin packets inside a unit-aim action', () => {
  const initial = percentageDotEncounter(),
    state = moved(initial, ['actor'])
  state.turnOrigin = {
    combatantId: 'actor',
    turnNumber: state.tactical.battle.turnNumber,
    position: position(initial, 'actor'),
  }
  const cast = action('enemy')
  cast.effects = [{ type: 'return-to-turn-start', recipient: 'actor', target: 'self' }]
  cast.effectTimingModes = ['instant']
  cast.target = { ...cast.target, maximumRange: 4 }
  expect(
    evaluateCombatAction(state, cast, { kind: 'unit', combatantId: 'enemy' }, content).legal,
  ).toBe(true)
  const restored = executeCombatAction(state, cast, { kind: 'unit', combatantId: 'enemy' }, content)
  expect(position(restored.state, 'actor')).toEqual(position(initial, 'actor'))
})

it('rejects a tile recipient disguised as a unit-targeted Rewind payload', () => {
  const cast = action('enemy')
  cast.effects = [
    {
      type: 'return-to-turn-start',
      recipient: 'affected-tiles',
      target: 'enemy',
      anchorMode: 'cast-position',
    } as never,
  ]
  expect(() =>
    evaluateCombatAction(
      percentageDotEncounter(),
      cast,
      { kind: 'unit', combatantId: 'enemy' },
      content,
    ),
  ).toThrow(/unit|recipient/i)
})

it('rejects substituting a caster scalar anchor for a captured external recipient map', () => {
  const state = executeCombatAction(
    { ...percentageDotEncounter(), effectTimingPolicy: { version: 2, modes: {} } },
    action('enemy'),
    { kind: 'unit', combatantId: 'enemy' },
    content,
  ).state
  const saved = JSON.parse(JSON.stringify(state)) as CombatEncounterState
  const pending = { ...saved.pendingEffects![0]! }
  delete pending.returnAnchors
  saved.pendingEffects = [{ ...pending, returnAnchor: { x: 1, y: 1 } }]
  expect(validateCombatEncounterState(saved)).toContainEqual(
    expect.objectContaining({ field: 'pendingEffects' }),
  )
})

it('an explicit external target edit upgrades old self Rewind to cast-position capture', () => {
  expect(
    withAuthoredEffectTarget({ type: 'return-to-turn-start', recipient: 'actor' }, 'enemy'),
  ).toMatchObject({ recipient: 'affected-units', target: 'enemy', anchorMode: 'cast-position' })
})
