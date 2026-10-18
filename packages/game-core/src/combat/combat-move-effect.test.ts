import { describe, expect, it } from 'vitest'
import { parseAbilityDefinition, validateAbilityDefinition } from './combat-definition'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import {
  executePv1fMovement,
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import type { CombatEncounterState } from './actions'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'

const move = {
  id: 'walk',
  payload: { type: 'move', recipient: 'actor', maximumTiles: 2 },
}
const hit = { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 10 } }
const path = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
]
function definition(
  effects: readonly unknown[] = [move, hit],
  overrides: Record<string, unknown> = {},
) {
  return {
    schemaVersion: 1,
    behaviors: [
      {
        ...source().definition.behaviors[0]!,
        costs: [
          { resource: 'ap', amount: 11 },
          { resource: 'mp', amount: 2 },
        ],
        targeting: {
          ...source().definition.behaviors[0]!.targeting!,
          geometryVersion: 3,
          categories: ['enemy', 'ground'],
          minimumRange: 0,
          maximumRange: 1,
        },
        accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
        effects,
        ...overrides,
      },
    ],
  }
}
function input(
  extraSources: ReturnType<typeof captureCombatAbilitySource>[] = [],
  overrides: Record<string, unknown> = {},
) {
  const captured = captureCombatAbilitySource({
    ...source(),
    definition: parseAbilityDefinition(definition([move, hit], overrides)),
  })
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  const state = reconcileCombatAbilitySources(
    {
      ...base,
      tactical: {
        ...base.tactical,
        placements: base.tactical.placements.map((p) => ({
          ...p,
          position:
            p.combatantId === 'enemy'
              ? { x: 3, y: 1 }
              : p.combatantId === 'other'
                ? { x: 4, y: 4 }
                : p.position,
        })),
      },
    },
    [captured, ...extraSources],
  )
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    movementPath: path,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
}
function actor(state: CombatEncounterState) {
  return state.tactical.battle.combatants.find((u) => u.id === 'actor')!
}

describe('registered Move on one paid skill command', () => {
  it.each([true, false])(
    'checks the Ground occupant for a selected-target prerequisite: Mark %s',
    (marked) => {
      const command = input([], {
        targeting: {
          ...source().definition.behaviors[0]!.targeting!,
          geometryVersion: 3,
          kind: 'ground-tile',
          categories: ['ground'],
          minimumRange: 0,
          maximumRange: 1,
        },
        requirements: {
          kind: 'status-presence',
          subject: 'selected',
          statusId: 'mark',
          present: true,
        },
        effects: [move, { ...hit, payload: { ...hit.payload, recipient: 'affected-units' } }],
      })
      const state = {
        ...command.state,
        modularSkillPolicyVersion: 1 as const,
        statusState: command.state.statusState.map((row) =>
          row.combatantId === 'enemy' && marked
            ? {
                ...row,
                statuses: [
                  {
                    statusId: 'mark',
                    statusVersion: 1,
                    stacks: 1,
                    sourceScopedMark: true as const,
                    sourceCombatantId: 'actor',
                    remainingOwnerTurnStarts: 2,
                  },
                ],
              }
            : row,
        ),
      }
      const castInput = {
        ...command,
        state,
        selection: { kind: 'tile' as const, position: { x: 3, y: 1 } },
      }
      expect(prepareCombatAbilityCommand(castInput).evaluation.legal).toBe(marked)
      if (marked)
        expect(commitCombatAbilityCommand(castInput).events).toContainEqual(
          expect.objectContaining({ event: 'damage_applied', targetCombatantId: 'enemy' }),
        )
      else expect(() => commitCombatAbilityCommand(castInput)).toThrow(/requirement-not-met/)
    },
  )
  it.each(['empty', 'hit', 'miss'] as const)(
    'executes a Ground Move with self healing on %s Ground, preserving hostile hit dependency',
    (target) => {
      const command = input([], {
        targeting: {
          ...source().definition.behaviors[0]!.targeting!,
          kind: 'ground-tile',
          geometryVersion: 3,
          categories: ['ground'],
          minimumRange: 0,
          maximumRange: 1,
        },
        accuracy: { kind: 'fixed', chanceBasisPoints: target === 'miss' ? 0 : 10000 },
        effects: [
          move,
          { ...hit, payload: { ...hit.payload, recipient: 'affected-units' } },
          { id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 17 } },
        ],
      })
      const state = {
        ...command.state,
        modularSkillPolicyVersion: 1 as const,
        tactical: {
          ...command.state.tactical,
          battle: {
            ...command.state.tactical.battle,
            combatants: command.state.tactical.battle.combatants.map((unit) =>
              unit.id === 'actor' ? { ...unit, hp: 500 } : unit,
            ),
          },
        },
      }
      const castInput = {
        ...command,
        state,
        selection: {
          kind: 'tile' as const,
          position: target === 'empty' ? { x: 2, y: 0 } : { x: 3, y: 1 },
        },
      }
      expect(prepareCombatAbilityCommand(castInput).evaluation.issues).toEqual([])
      const cast = commitCombatAbilityCommand(castInput)
      expect(
        cast.state.tactical.placements.find((row) => row.combatantId === 'actor')!.position,
      ).toEqual({ x: 2, y: 1 })
      expect(actor(cast.state).hp).toBe(target === 'miss' ? 500 : 517)
      expect(actor(cast.state).mp).toBe(18)
      expect(
        actor(cast.state).temporaryResources.find((row) => row.key === 'pv1f.action-economy')!
          .current,
      ).toBe(89)
      expect(cast.events.filter((event) => event.event === 'damage_applied')).toHaveLength(
        target === 'hit' ? 1 : 0,
      )
    },
  )
  it('accepts bounded Manual Move first and rejects unsupported order, repetition, activation and timing', () => {
    expect(validateAbilityDefinition(definition())).toEqual([])
    for (const [effects, overrides] of [
      [[hit, move], {}],
      [[move, { ...move, id: 'walk-again' }, hit], {}],
      [[move, hit], { activation: 'automatic' }],
      [[move, hit], { mode: 'modifier' }],
      [[{ ...move, timing: 'next-round' }, hit], {}],
      [[{ ...move, payload: { ...move.payload, apPerTraversalPoint: 9 } }, hit], {}],
      [[{ ...move, payload: { ...move.payload, apPerTraversalPoint: 101 } }, hit], {}],
      [[{ ...move, payload: { ...move.payload, maximumTiles: 21 } }, hit], {}],
      [[{ ...move, payload: { ...move.payload, maximumTiles: 0 } }, hit], {}],
    ] as const)
      expect(validateAbilityDefinition(definition(effects, overrides))).not.toEqual([])
  })
  it('quotes the follow-up from the destination without payment, mutation or RNG', () => {
    const command = input(),
      before = JSON.stringify(command.state)
    const quote = prepareCombatAbilityCommand(command)
    expect(quote.evaluation.legal).toBe(true)
    expect(quote.evaluation.affectedCombatantIds).toEqual(['enemy'])
    expect(quote.costs).toEqual([
      { resource: 'ap', amount: 11 },
      { resource: 'mp', amount: 2 },
    ])
    expect(JSON.stringify(command.state)).toBe(before)
  })
  it('moves then attacks from the reached tile and pays the overall authored skill cost once', () => {
    const command = input()
    const cast = commitCombatAbilityCommand(command)
    expect(cast.state.tactical.placements.find((p) => p.combatantId === 'actor')!.position).toEqual(
      { x: 2, y: 1 },
    )
    expect(cast.state.tactical.battle.combatants.find((u) => u.id === 'enemy')!.hp).toBeLessThan(
      1000,
    )
    expect(
      actor(cast.state).temporaryResources.find(
        (resource) => resource.key === 'pv1f.action-economy',
      )!.current,
    ).toBe(89)
    expect(actor(cast.state).mp).toBe(18)
    expect(
      cast.events.filter(
        (event) => event.event === 'combat_action_used' && event.actionId === 'test.ability',
      ),
    ).toHaveLength(1)
    expect(cast.events.filter((event) => event.event === 'mp_spent')).toHaveLength(1)
  })
  it('rejects an over-cap or non-orthogonal path before any payment or usage', () => {
    const command = input(),
      before = JSON.stringify(command.state)
    for (const movementPath of [
      [
        { x: 1, y: 1 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
      [
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ],
      [{ x: 1, y: 1 }],
    ]) {
      const invalid = { ...command, movementPath }
      expect(prepareCombatAbilityCommand(invalid).evaluation.legal).toBe(false)
      expect(() => commitCombatAbilityCommand(invalid)).toThrow()
      expect(JSON.stringify(command.state)).toBe(before)
    }
  })
  it('keeps a paid interruption when a before-use reaction roots the actor', () => {
    const reaction = captureCombatAbilitySource({
      ...source({}, 'root-reaction'),
      abilityId: 'root.child',
      definition: parseAbilityDefinition(
        definition(
          [
            {
              id: 'root',
              payload: {
                type: 'apply-status',
                recipient: 'actor',
                statusId: 'root',
                durationTurns: 1,
                stacks: 1,
              },
            },
          ],
          {
            activation: 'automatic',
            classification: 'utility',
            attackFamily: undefined,
            accuracy: undefined,
            costs: [],
            activationLimits: ['once-per-action'],
            requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
            targeting: {
              kind: 'self',
              teamPolicy: 'self',
              friendlyFire: 'allies-only',
              shape: { kind: 'single' },
              minimumRange: 0,
              maximumRange: 0,
              requiresLineOfSight: false,
              maximumElevationDifference: null,
              maximumSelections: 1,
            },
          },
        ),
      ),
    })
    const cast = commitCombatAbilityCommand(input([reaction]))
    expect(cast.state.tactical.placements.find((p) => p.combatantId === 'actor')!.position).toEqual(
      { x: 1, y: 1 },
    )
    expect(cast.state.tactical.battle.combatants.find((u) => u.id === 'enemy')!.hp).toBe(1000)
    expect(
      actor(cast.state).temporaryResources.find(
        (resource) => resource.key === 'pv1f.action-economy',
      )!.current,
    ).toBe(89)
    expect(actor(cast.state).mp).toBe(18)
    expect(cast.events).toContainEqual(
      expect.objectContaining({ event: 'combat_action_interrupted', reason: 'selection-invalid' }),
    )
  })
})

it('keeps the walking receipts in the captured Covert command visibility', () => {
  const command = input()
  const state = {
    ...command.state,
    statusState: command.state.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'covert',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'actor',
              },
            ],
          }
        : row,
    ),
  }
  const cast = commitCombatAbilityCommand({ ...command, state })
  const walked = cast.events.find((event) => event.event === 'combatant_moved')!
  expect(walked).toBeDefined()
  expect(walked.sourceCommandVisibility).toEqual({ kind: 'team-only', teamId: 'players' })
})

it('retains the paid skill cost and reached prefix when Poison defeats the walker', () => {
  const command = input()
  const state = {
    ...command.state,
    tactical: {
      ...command.state.tactical,
      battle: {
        ...command.state.tactical.battle,
        combatants: command.state.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor' ? { ...unit, hp: 4 } : unit,
        ),
      },
      placements: command.state.tactical.placements.map((p) =>
        p.combatantId === 'enemy' ? { ...p, position: { x: 4, y: 1 } } : p,
      ),
    },
    effectState: {
      ongoingRecovery: [],
      poison: [
        {
          targetCombatantId: 'actor',
          sourceCombatantId: 'enemy',
          sourceActionId: 'test.poison-source',
          profileVersion: 1,
          damagePerTick: 5,
          remainingTicks: 2,
          applicationOrder: 1,
          movementRemainder: 4,
        },
      ],
      bleed: [],
      burn: [],
      damageHistory: [],
    },
  }
  const cast = commitCombatAbilityCommand({
    ...command,
    state,
    movementPath: [...path, { x: 3, y: 1 }],
  })
  expect(actor(cast.state).hp).toBe(0)
  expect(
    actor(cast.state).temporaryResources.find((resource) => resource.key === 'pv1f.action-economy')!
      .current,
  ).toBe(89)
  expect(actor(cast.state).mp).toBe(18)
  expect(cast.state.tactical.placements.find((p) => p.combatantId === 'actor')!.position).toEqual({
    x: 2,
    y: 1,
  })
  expect(cast.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(1000)
  expect(cast.events).toContainEqual(
    expect.objectContaining({ event: 'combat_action_interrupted', reason: 'actor-unavailable' }),
  )
  expect(
    cast.events.filter(
      (event) => event.event === 'combat_action_used' && event.actionId === 'test.ability',
    ),
  ).toHaveLength(1)
})

it('admits an affordable optional modifier without reserving additional walking AP', () => {
  const modifier = captureCombatAbilitySource({
    ...source({}, 'move-modifier'),
    abilityId: 'move.bonus',
    definition: parseAbilityDefinition(
      definition(
        [
          {
            id: 'bonus',
            payload: { type: 'damage', recipient: 'primary-unit', amount: 2 },
          },
        ],
        {
          activation: 'automatic',
          mode: 'modifier',
          targeting: null,
          accuracy: undefined,
          costs: [{ resource: 'ap', amount: 60 }],
          requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
        },
      ),
    ),
  })
  const command = input([modifier])
  const quote = prepareCombatAbilityCommand(command)
  expect(quote.evaluation.legal).toBe(true)
  expect(quote.modifierSuppressions).toEqual([])
  expect(quote.costs).toEqual([
    { resource: 'ap', amount: 71 },
    { resource: 'mp', amount: 2 },
  ])
  const cast = commitCombatAbilityCommand(command)
  expect(
    actor(cast.state).temporaryResources.find((resource) => resource.key === 'pv1f.action-economy')!
      .current,
  ).toBe(29)
})

it('moves after spending all AP on the skill without another AP charge', () => {
  const cast = commitCombatAbilityCommand(input([], { costs: [{ resource: 'ap', amount: 100 }] }))
  expect(cast.state.tactical.placements.find((p) => p.combatantId === 'actor')!.position).toEqual({
    x: 2,
    y: 1,
  })
  expect(
    actor(cast.state).temporaryResources.find((r) => r.key === 'pv1f.action-economy')!.current,
  ).toBe(0)
  expect(cast.events.filter((event) => event.event === 'ap_spent')).toHaveLength(1)
  expect(cast.state.tactical.battle.combatants.find((u) => u.id === 'enemy')!.hp).toBeLessThan(1000)
})

it('still rejects a path beyond remaining Movement before paying the skill', () => {
  const command = input()
  const turn = command.state.tactical.battle.currentTurn!
  const state = {
    ...command.state,
    tactical: {
      ...command.state.tactical,
      battle: {
        ...command.state.tactical.battle,
        currentTurn: { ...turn, movementSpent: turn.movementMaximum, movementRemaining: 0 },
      },
    },
  }
  const invalid = { ...command, state }
  expect(prepareCombatAbilityCommand(invalid).evaluation.legal).toBe(false)
  expect(() => commitCombatAbilityCommand(invalid)).toThrow()
  expect(actor(state).mp).toBe(20)
  expect(
    actor(state).temporaryResources.find((r) => r.key === 'pv1f.action-economy')!.current,
  ).toBe(100)
})

it('supports a pure utility Move at its overall authored cost', () => {
  const command = input([], {
    classification: 'utility',
    attackFamily: undefined,
    accuracy: undefined,
    effects: [move],
    targeting: {
      ...source().definition.behaviors[0]!.targeting!,
      kind: 'self',
      teamPolicy: 'self',
      friendlyFire: 'allies-only',
      minimumRange: 0,
      maximumRange: 0,
    },
  })
  const cast = commitCombatAbilityCommand({ ...command, selection: { kind: 'self' } })
  expect(cast.state.tactical.placements.find((p) => p.combatantId === 'actor')!.position).toEqual({
    x: 2,
    y: 1,
  })
  expect(
    actor(cast.state).temporaryResources.find((r) => r.key === 'pv1f.action-economy')!.current,
  ).toBe(89)
  expect(actor(cast.state).mp).toBe(18)
  expect(cast.state.tactical.battle.currentTurn!.movementRemaining).toBe(3)
})

it('preserves standalone native Move cost and receipt behavior', () => {
  const command = input()
  const cast = executePv1fMovement(
    reattachStatDrivenCombatBridge(command.state, percentageDotEncounter().statBridge),
    path,
  )
  expect(
    actor(cast.state).temporaryResources.find((r) => r.key === 'pv1f.action-economy')!.current,
  ).toBe(80)
  expect(actor(cast.state).mp).toBe(20)
  expect(cast.events).toContainEqual(
    expect.objectContaining({ event: 'action_economy_spent', amount: 20, remaining: 80 }),
  )
  expect(
    cast.events.filter(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        'event' in event &&
        event.event === 'combat_action_used',
    ),
  ).toHaveLength(0)
})

it('locks effect Requirements against the original pre-payment state', () => {
  const command = input([], {
    effects: [
      move,
      {
        ...hit,
        requirements: {
          kind: 'resource-state',
          subject: 'owner',
          resource: 'mp',
          comparison: 'at-least',
          amount: 20,
        },
      },
    ],
  })
  const cast = commitCombatAbilityCommand(command)
  expect(actor(cast.state).mp).toBe(18)
  expect(cast.state.tactical.battle.combatants.find((u) => u.id === 'enemy')!.hp).toBeLessThan(1000)
})

it('pays authored AP, MP and HP atomically without an additional walking payment', () => {
  const command = input([], {
    costs: [
      { resource: 'ap', amount: 11 },
      { resource: 'mp', amount: 2 },
      { resource: 'hp', amount: 5 },
    ],
  })
  const cast = commitCombatAbilityCommand(command)
  expect(actor(cast.state).hp).toBe(995)
  expect(actor(cast.state).mp).toBe(18)
  expect(
    actor(cast.state).temporaryResources.find((r) => r.key === 'pv1f.action-economy')!.current,
  ).toBe(89)
  expect(cast.events.filter((event) => event.event === 'ap_spent')).toHaveLength(1)
  expect(cast.events.filter((event) => event.event === 'mp_spent')).toHaveLength(1)
  const invalid = input([], {
    costs: [
      { resource: 'ap', amount: 11 },
      { resource: 'mp', amount: 21 },
      { resource: 'hp', amount: 5 },
    ],
  })
  const before = JSON.stringify(invalid.state)
  expect(() => commitCombatAbilityCommand(invalid)).toThrow()
  expect(JSON.stringify(invalid.state)).toBe(before)
})

it('rejects walking references for a skill without a Move effect', () => {
  const command = input([], {
    effects: [hit],
    targeting: {
      ...source().definition.behaviors[0]!.targeting!,
      geometryVersion: 3,
      categories: ['enemy'],
      minimumRange: 0,
      maximumRange: 3,
    },
  })
  expect(
    prepareCombatAbilityCommand({ ...command, movementPath: undefined }).evaluation.legal,
  ).toBe(true)
  expect(prepareCombatAbilityCommand(command).evaluation.legal).toBe(false)
  expect(() => commitCombatAbilityCommand(command)).toThrow()
})

it('permits a reference-free stationary follow-up only when conditional Move is ineligible at S0', () => {
  const command = input([], {
    effects: [
      {
        ...move,
        requirements: {
          kind: 'status-presence',
          subject: 'owner',
          statusId: 'guarded',
          present: true,
        },
      },
      hit,
    ],
    targeting: {
      ...source().definition.behaviors[0]!.targeting!,
      geometryVersion: 3,
      categories: ['enemy'],
      minimumRange: 0,
      maximumRange: 3,
    },
  })
  const stationary = {
    ...command,
    movementPath: undefined,
    state: {
      ...command.state,
      tactical: {
        ...command.state.tactical,
        battle: {
          ...command.state.tactical.battle,
          currentTurn: {
            ...command.state.tactical.battle.currentTurn!,
            movementRemaining: 0,
            movementSpent: command.state.tactical.battle.currentTurn!.movementMaximum,
          },
        },
      },
    },
  }
  const before = JSON.stringify(stationary.state)
  expect(prepareCombatAbilityCommand(stationary).evaluation.legal).toBe(true)
  const cast = commitCombatAbilityCommand(stationary)
  expect(
    cast.state.tactical.placements.find((row) => row.combatantId === 'actor')!.position,
  ).toEqual({ x: 1, y: 1 })
  expect(cast.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(990)
  expect(actor(cast.state).mp).toBe(18)
  expect(
    actor(cast.state).temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current,
  ).toBe(89)
  expect(JSON.stringify(stationary.state)).toBe(before)
  expect(
    prepareCombatAbilityCommand({
      ...stationary,
      movementPath: [
        { x: -1, y: 1 },
        { x: 0, y: 1 },
      ],
    }).evaluation.legal,
  ).toBe(false)
  const required = input()
  expect(
    prepareCombatAbilityCommand({ ...required, movementPath: undefined }).evaluation.legal,
  ).toBe(false)
})
